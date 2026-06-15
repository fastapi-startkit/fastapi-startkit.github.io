---
outline: deep
title: Background Queues with TaskIQ
description: Run background jobs in Fastapi Startkit by integrating TaskIQ as a Redis-backed task queue using a service provider.
keywords: taskiq, background tasks, queue, redis, service provider, fastapi, async jobs
---

# Background Queues

Fastapi Startkit does not ship a queue of its own, but its provider and container
make it straightforward to plug one in. This guide shows how to integrate
[TaskIQ](https://taskiq-python.github.io/) — an async-native distributed task
queue — using a Redis broker, wired into the application through a service
provider.

The pattern is:

1. A `QueueProvider` builds a TaskIQ broker and binds it into the container as
   `broker` during `register()`.
2. In `boot()`, the broker's `startup`/`shutdown` are attached to the FastAPI
   lifecycle so the connection opens and closes with the web process.
3. Tasks resolve the same `broker` binding from the booted application singleton
   and register themselves with the `@broker.task` decorator.

## Installation

Install TaskIQ and the Redis broker package:

```bash
uv add taskiq taskiq-redis
# or
pip install taskiq taskiq-redis
```

You also need a running Redis server. The repository ships a `docker-compose.yml`
with Redis, or you can run it directly:

```bash
docker run -p 6379:6379 redis
```

## Configuration

The broker connects to Redis using `REDIS_HOST` and `REDIS_PORT`. Add them to
your `.env`:

```ini
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

Read them with the framework's `env()` helper. `env()` infers the type of the
returned value — a numeric string such as `"6379"` comes back as an `int`,
everything else stays a `str` — so a small config dataclass keeps the values
typed:

```python
# config/queue.py
from dataclasses import dataclass, field

from fastapi_startkit.environment import env


@dataclass
class QueueConfig:
    redis_host: str = field(default_factory=lambda: env("REDIS_HOST", "localhost"))
    redis_port: int = field(default_factory=lambda: env("REDIS_PORT", "6379"))
```

## The Queue Provider

Create a provider that builds the broker and binds it into the container. The
`register()` method runs while the application boots, so the `broker` binding is
available to every other provider and to your task modules.

```python
# providers/queue_provider.py
from taskiq_redis import ListQueueBroker, RedisAsyncResultBackend

from fastapi_startkit.providers import Provider

from config.queue import QueueConfig


class QueueProvider(Provider):
    provider_key = "queue"

    def register(self) -> None:
        """Build the TaskIQ broker and bind it as `broker`."""
        config = self.resolve_config(QueueConfig)
        url = f"redis://{config['redis_host']}:{config['redis_port']}"

        broker = ListQueueBroker(url=url).with_result_backend(
            RedisAsyncResultBackend(redis_url=url)
        )

        self.app.bind("broker", broker)

    def boot(self) -> None:
        """Open and close the broker connection with the web process."""
        broker = self.app.make("broker")

        self.app.add_event_handler("startup", broker.startup)
        self.app.add_event_handler("shutdown", broker.shutdown)
```

`resolve_config(QueueConfig)` returns a plain dict that merges the dataclass
defaults with any configuration passed when the provider is registered, so
`config['redis_host']` and `config['redis_port']` are always populated.

::: tip Why bind as `broker`?
Binding the broker under a stable key (`broker`) means tasks, controllers and
commands can all resolve the *same* instance from the container with
`app.make("broker")` — there is only ever one broker per process.
:::

### A note on startup/shutdown vs. lifespan

The framework wires the broker through `Application.add_event_handler`, which
delegates to Starlette's `add_event_handler("startup"/"shutdown", ...)`. This is
the same mechanism behind the `@app.on_event` decorator, which newer Starlette
releases mark as **deprecated in favour of lifespan handlers**. It remains fully
functional and is the lifecycle hook the framework currently exposes:
`FastAPIProvider` constructs the `FastAPI()` instance internally and does not
offer a hook to pass a custom `lifespan=`. If you need a lifespan-based broker
setup, replace the FastAPI instance with your own provider that calls
`self.app.use_fastapi(FastAPI(lifespan=...))`.

## Registering the Provider

Add `QueueProvider` to your application's providers list. Register it **after**
`FastAPIProvider` so the FastAPI instance exists when the broker attaches its
startup/shutdown handlers:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

from config.fastapi import FastAPIConfig
from providers.queue_provider import QueueProvider

app: Application = Application(
    base_path=str(Path.cwd()),
    providers=[
        (FastAPIProvider, FastAPIConfig),
        QueueProvider,
    ],
)
```

## Defining Tasks

Tasks need the broker at import time so the `@broker.task` decorator can register
them. Because `bootstrap/application.py` instantiates `Application(...)` at module
level — and the constructor runs every provider's `register()` and `boot()` — the
`broker` binding already exists by the time the module finishes importing. You can
therefore resolve it from the application singleton outside of any request:

```python
# app/tasks.py
from bootstrap.application import app

broker = app.make("broker")


@broker.task
async def send_welcome_email(user_id: int) -> str:
    # ... do the work, e.g. load the user and send mail ...
    return f"welcomed {user_id}"
```

::: warning Resolving `broker` outside a request
`app.make("broker")` returns the broker as soon as `bootstrap.application` is
imported — this works in tasks, commands and scripts, not just inside requests.
What it does **not** do is *start* the broker: `broker.startup()` only runs from
the FastAPI startup event (or the worker, below). Inside a request the startup
event has already fired, so dispatching just works. From a standalone script you
must start the broker yourself before dispatching — see
[Dispatching outside a request](#dispatching-outside-a-request). If the binding
is missing you'll get `MissingContainerBindingNotFound`, which means the provider
was not registered.
:::

## Dispatching Tasks

### From a request

Inside a route or controller, dispatch with `.kiq()`. The FastAPI startup event
has already called `broker.startup()`, so the broker is connected and ready:

```python
# app/http/controllers/users_controller.py
from app.tasks import send_welcome_email


async def store(data: UserSchema):
    user = await User.create(**data.model_dump())

    # Hand the work off to the queue and return immediately.
    await send_welcome_email.kiq(user.id)

    return user
```

`.kiq()` returns a task handle. If you configured a result backend (as the
provider above does), you can await the result when you need it:

```python
task = await send_welcome_email.kiq(user.id)
result = await task.wait_result(timeout=5)

if not result.is_err:
    print(result.return_value)
```

### Dispatching outside a request

When dispatching from a standalone script or a one-off command, the FastAPI
startup event never fires, so start the broker yourself first and shut it down
when you're done:

```python
import asyncio

from bootstrap.application import app
from app.tasks import send_welcome_email

broker = app.make("broker")


async def main() -> None:
    await broker.startup()
    try:
        await send_welcome_email.kiq(42)
    finally:
        await broker.shutdown()


asyncio.run(main())
```

## Running a Worker

Dispatched tasks stay in Redis until a worker picks them up. Start one with the
TaskIQ CLI, pointing it at the module path and the broker variable
(`module:variable`):

```bash
taskiq worker app.tasks:broker
```

Importing `app.tasks` loads every `@broker.task` in that module, so the worker
knows how to execute them. The CLI calls `broker.startup()` and `broker.shutdown()`
for the worker process itself — you do not need to manage that here.

To register tasks that live in several modules, import them all where the broker
is defined (or pass the additional modules to the worker):

```bash
taskiq worker app.tasks:broker app.tasks.emails app.tasks.reports
```

During development, add `--reload` to restart the worker when your task code
changes:

```bash
taskiq worker app.tasks:broker --reload
```

## Summary

| Step | Where |
|---|---|
| Build the broker, bind it as `broker` | `QueueProvider.register()` |
| Open/close the connection with the web process | `QueueProvider.boot()` |
| Register the provider | `bootstrap/application.py` |
| Define tasks with `@broker.task` | `app/tasks.py` |
| Dispatch with `.kiq()` | controllers, scripts, commands |
| Process the queue | `taskiq worker app.tasks:broker` |
