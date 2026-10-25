---
outline: deep
title: Background Queues with TaskIQ
description: Run background jobs with TaskIQ and a Redis broker, wired in through a service provider.
keywords: taskiq, background tasks, queue, redis, service provider, fastapi, async jobs
---

# Background Queues

Some work doesn't belong in a web request. Sending a welcome email or generating a report can take a while, and your users shouldn't have to wait for it. A queue lets you hand that work to a background worker and respond right away.

FastAPI Startkit doesn't ship a queue of its own, but it's straightforward to add one. This guide wires in [TaskIQ](https://taskiq-python.github.io/), an async task queue, with a Redis broker. The setup has three pieces:

1. A `QueueProvider` builds the broker and binds it into the container as
   `broker` in `register()`.
2. Its `boot()` opens and closes the broker connection with the web process.
3. `bootstrap/broker.py` resolves the same broker from the application, and
   tasks register on it with `@broker.task`.

## Installation

First, install TaskIQ and the Redis broker package:

```bash
uv add taskiq taskiq-redis
# or
pip install taskiq taskiq-redis
```

You'll also need a Redis server. If you don't have one running, you can start one with Docker:

```bash
docker run -p 6379:6379 redis
```

## Configuration

The broker reads `REDIS_HOST` and `REDIS_PORT`, so add them to your `.env`:

```ini
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

Then read them in a config dataclass. `env()` casts the value to the type of its default, so `REDIS_PORT` comes back as an `int`:

```python
# config/queue.py
from dataclasses import dataclass

from fastapi_startkit.environment import env


@dataclass
class QueueConfig:
    redis_host: str = env("REDIS_HOST", "localhost")
    redis_port: int = env("REDIS_PORT", 6379)
```

## The Queue Provider

The provider is where the broker comes to life. It builds the broker in `register()` and binds it as `broker`, so other providers and your task modules can resolve it:

```python
# providers/queue_provider.py
from taskiq_redis import ListQueueBroker, RedisAsyncResultBackend

from fastapi_startkit.support import Provider

from config.queue import QueueConfig


class QueueProvider(Provider):
    provider_key = "queue"

    def register(self) -> None:
        config = self.resolve_config(QueueConfig)
        url = f"redis://{config['redis_host']}:{config['redis_port']}"

        broker = ListQueueBroker(url=url).with_result_backend(
            RedisAsyncResultBackend(redis_url=url)
        )

        self.app.bind("broker", broker)

    def boot(self) -> None:
        broker = self.app.make("broker")

        self.app.add_event_handler("startup", broker.startup)
        self.app.add_event_handler("shutdown", broker.shutdown)
```

`resolve_config(QueueConfig)` returns a dict of the dataclass values, with any config class passed at registration merged on top.

::: tip Why bind as `broker`?
With one container key, your tasks, controllers, and commands all get the same broker instance from `app.make("broker")`.
:::

### A note on startup/shutdown vs. lifespan

`Application.add_event_handler` calls Starlette's `add_event_handler("startup"/"shutdown", ...)`, the mechanism behind `@app.on_event`. Starlette deprecates it in favour of lifespan handlers, but it still works, and `FastAPIProvider` gives you no way to pass `lifespan=`. If you'd prefer a lifespan, register your own provider that calls `self.app.use_fastapi(FastAPI(lifespan=...))`.

## Registering the Provider

Next, register `QueueProvider` after `FastAPIProvider`, so the FastAPI instance exists by the time `boot()` adds the event handlers:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

from config.fastapi import FastAPIConfig
from providers.queue_provider import QueueProvider

app: Application = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        (FastAPIProvider, FastAPIConfig),
        QueueProvider,
    ],
)
```

## Exposing the Broker

Your tasks and the TaskIQ worker must import the same broker instance. The cleanest way to share it is to resolve it in `bootstrap/broker.py`:

```python
# bootstrap/broker.py
from bootstrap.application import app

broker = app.make("broker")
```

This works because `bootstrap/application.py` creates the `Application` at import time, and the constructor runs every provider's `register()` and `boot()`. So once it's imported, `app.make("broker")` works outside a request. The worker loads `bootstrap.broker:broker`.

::: warning Resolving `broker` outside a request
Resolving the broker doesn't start it. `broker.startup()` runs from the FastAPI startup event, or in the worker, so inside a request it has already run. In a standalone script, you'll need to start the broker yourself; see [Dispatching outside a request](#dispatching-outside-a-request). If you get `MissingContainerBindingNotFound`, `QueueProvider` isn't registered.
:::

## Defining Tasks

With the broker in place, defining a task is short. Import `broker` and decorate each task with `@broker.task`:

```python
# app/tasks.py
from bootstrap.broker import broker


@broker.task
async def send_welcome_email(user_id: int) -> str:
    # ... do the work, e.g. load the user and send mail ...
    return f"welcomed {user_id}"
```

## Dispatching Tasks

### From a request

Inside a route or controller, dispatch a task with `.kiq()`:

```python
# app/http/controllers/users_controller.py
from app.tasks import send_welcome_email


async def store(data: UserSchema):
    user = await User.create(**data.model_dump())

    await send_welcome_email.kiq(user.id)

    return user
```

`.kiq()` returns a task handle. Since the provider above configures a result backend, you can also wait for the result:

```python
task = await send_welcome_email.kiq(user.id)
result = await task.wait_result(timeout=5)

if not result.is_err:
    print(result.return_value)
```

### Dispatching outside a request

In a script or command, the FastAPI startup event never fires, so the broker isn't started for you. Start it before dispatching and shut it down afterwards:

```python
import asyncio

from bootstrap.broker import broker
from app.tasks import send_welcome_email


async def main() -> None:
    await broker.startup()
    try:
        await send_welcome_email.kiq(42)
    finally:
        await broker.shutdown()


asyncio.run(main())
```

## Running a Worker

Dispatched tasks wait in Redis until a worker picks them up. To start a worker, give it the broker (`module:variable`) and the modules that define your tasks:

```bash
taskiq worker bootstrap.broker:broker app.tasks
```

The worker imports each module so its tasks register, and it starts and stops the broker itself. Be sure to list every module that defines tasks:

```bash
taskiq worker bootstrap.broker:broker app.tasks app.tasks.emails app.tasks.reports
```

During development, add `--reload` to restart the worker whenever your code changes:

```bash
taskiq worker bootstrap.broker:broker app.tasks --reload
```

## Summary

Here's the whole setup at a glance:

| Step | Where |
|---|---|
| Build the broker, bind it as `broker` | `QueueProvider.register()` |
| Open/close the connection with the web process | `QueueProvider.boot()` |
| Register the provider | `bootstrap/application.py` |
| Expose the broker for tasks and the worker | `bootstrap/broker.py` |
| Define tasks with `@broker.task` | `app/tasks.py` |
| Dispatch with `.kiq()` | controllers, scripts, commands |
| Process the queue | `taskiq worker bootstrap.broker:broker app.tasks` |
