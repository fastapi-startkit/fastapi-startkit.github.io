---
outline: deep
title: Queues
description: Run background jobs with TaskIQ and Redis, dispatch them from your routes, and process them with the queue:work command.
keywords: taskiq, background tasks, queue, redis, worker, queue:work, fastapi, async jobs
---

# Queues

Some work doesn't belong in a web request. Sending a welcome email or generating a report can take a while, and your users shouldn't wait for it. Queues let you hand that work to a background worker and respond right away. The framework's installer sets up queues with [TaskIQ](https://taskiq-python.github.io/) and a Redis broker, and gives you a `queue:work` command to process them.

## Creating a Queue Application

The quickest way to get a queue is to let the installer generate one. Pass `--app=worker` for a worker-only application, or `--app=both` for an HTTP server and a worker in the same project:

```bash
uvx fastapi-startkit@latest init my-app --app=both
```

Along with the usual project files, the installer creates:

| File | Purpose |
|---|---|
| `config/queue.py` | The `QueueConfig` dataclass |
| `providers/queue_provider.py` | Builds the broker and registers the `queue:work` command |
| `worker.py` | Exposes the broker to the TaskIQ worker |
| `tasks/example_task.py` | An example task |
| `commands/queue_work_command.py` | The `queue:work` command |

It also adds `taskiq` and `taskiq-redis` to your dependencies and registers `QueueProvider` in `bootstrap/application.py`.

## Configuration

The queue reads two environment variables:

```ini
# .env
QUEUE_DRIVER=redis
QUEUE_URL=redis://127.0.0.1:6379/0
```

| Driver | Description |
|---|---|
| `redis` | Sends tasks through Redis at `QUEUE_URL`, and stores their results there. Use it whenever a separate worker processes the queue. |
| `memory` | Runs each task in the process that dispatched it. Use it in tests. |

With the `redis` driver, you need a running Redis server. If you don't have one, you can start one with Docker:

```bash
docker run -p 6379:6379 redis
```

## Adding Queues to an Existing Application

If your application was created without a worker, you can add the same files by hand. First, install TaskIQ and its Redis broker:

```bash
uv add taskiq taskiq-redis
```

Next, add the config class:

```python
# config/queue.py
from dataclasses import dataclass

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env


@dataclass
class QueueConfig(Config):
    driver: str = env("QUEUE_DRIVER", "redis")
    url: str = env("QUEUE_URL", "redis://127.0.0.1:6379/0")
```

The provider builds the broker and binds it into the container as both `broker` and `queue`. In an application that also serves HTTP, it starts the broker when the server starts and shuts it down when the server stops. Set `manages_http_lifespan` to `False` in a worker-only application:

```python
# providers/queue_provider.py
from contextlib import asynccontextmanager

from taskiq import InMemoryBroker
from taskiq_redis import ListQueueBroker, RedisAsyncResultBackend

from commands.queue_work_command import QueueWorkCommand
from config.queue import QueueConfig
from fastapi_startkit.support import Provider


class QueueProvider(Provider):
    manages_http_lifespan = True

    def register(self):
        config = self.resolve_config(QueueConfig)
        self.merge_config_from(config, self.provider_key)
        if config["driver"] == "memory":
            broker = InMemoryBroker()
        elif config["driver"] == "redis":
            broker = ListQueueBroker(config["url"]).with_result_backend(RedisAsyncResultBackend(config["url"]))
        else:
            raise ValueError("QUEUE_DRIVER must be redis or memory")
        self.app.bind("broker", broker)
        self.app.bind("queue", broker)

    def boot(self):
        self.commands([QueueWorkCommand])
        if not self.manages_http_lifespan:
            return
        broker = self.app.make("broker")
        router = self.app.fastapi.router
        previous_lifespan = router.lifespan_context

        @asynccontextmanager
        async def lifespan(app):
            if broker.is_worker_process:
                async with previous_lifespan(app) as state:
                    yield state
                return
            await broker.startup()
            try:
                async with previous_lifespan(app) as state:
                    yield state
            finally:
                await broker.shutdown()

        router.lifespan_context = lifespan
```

The worker needs a module-level broker to load, so expose it in `worker.py` at the root of your project:

```python
# worker.py
from bootstrap.application import app

broker = app.make("broker")
```

Then add the `queue:work` command. It starts the TaskIQ worker with the broker from `worker.py` and the modules that define your tasks:

```python
# commands/queue_work_command.py
import subprocess
import sys

from cleo.helpers import option
from fastapi_startkit.console.command import Command


class QueueWorkCommand(Command):
    name = "queue:work"
    description = "Start the TaskIQ worker."
    options = [option("workers", "w", "Number of worker processes", flag=False, default="1")]

    def handle(self):
        try:
            workers = int(self.option("workers"))
            if workers < 1:
                raise ValueError
        except (TypeError, ValueError):
            self.line_error("--workers must be a positive integer", style="error")
            return 1
        return subprocess.run([
            sys.executable, "-m", "taskiq", "worker", "worker:broker", "tasks.example_task", "--workers", str(workers),
        ], check=False).returncode
```

Finally, register the provider in `bootstrap/application.py`, and add empty `commands/__init__.py` and `tasks/__init__.py` files so both folders are importable:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

from config.queue import QueueConfig
from providers.queue_provider import QueueProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        FastAPIProvider,
        (QueueProvider, QueueConfig),
    ],
)
```

## Defining Tasks

A task is an `async` function decorated with the broker's `task` decorator. The `Queue` facade resolves the broker the provider bound as `queue`, so you can decorate tasks with `@Queue.task`:

```python
# tasks/example_task.py
from fastapi_startkit.facades import Queue


@Queue.task
async def send_welcome_email(email: str, name: str) -> dict:
    return {"status": "sent", "email": email, "name": name}
```

The installer's example task imports `broker` from `worker.py` instead. Both decorate the same broker, but `worker.py` imports `bootstrap.application`, so a task module that imports it can't be imported from a module the application loads while it boots, such as your route files. The `Queue` facade works in both places.

The facade does need the application to exist when the task module is imported. The worker and your routes take care of that; in a standalone script, import `worker` or `bootstrap.application` before your tasks.

## Dispatching Tasks

To push a task onto the queue, `await` its `kiq()` method with the task's arguments. It returns as soon as the task is queued:

```python
# routes/api.py
from pydantic import BaseModel

from fastapi_startkit.fastapi import Router
from tasks.example_task import send_welcome_email

router = Router()


class RegisterUser(BaseModel):
    email: str
    name: str


async def register(data: RegisterUser):
    task = await send_welcome_email.kiq(data.email, data.name)
    return {"task_id": task.task_id}


router.post("/users", register)
```

`kiq()` returns a task handle. With the `redis` driver, results are stored in Redis, so you may wait for one:

```python
task = await send_welcome_email.kiq("taylor@example.com", "Taylor")
result = await task.wait_result(timeout=10)

if not result.is_err:
    print(result.return_value)  # {'status': 'sent', 'email': 'taylor@example.com', 'name': 'Taylor'}
```

### Dispatching Outside a Request

Inside a request, the broker has already been started by the provider. In a script or a console command, start it yourself before dispatching and shut it down afterwards:

```python
# send_welcome.py
import asyncio

from worker import broker
from tasks.example_task import send_welcome_email


async def main() -> None:
    await broker.startup()
    try:
        await send_welcome_email.kiq("taylor@example.com", "Taylor")
    finally:
        await broker.shutdown()


asyncio.run(main())
```

## Running the Worker

Dispatched tasks wait in Redis until a worker processes them. To start one, run the `queue:work` command:

```bash
uv run python artisan queue:work
```

To run several worker processes, pass `--workers`:

```bash
uv run python artisan queue:work --workers 4
```

When the application serves HTTP as well, run the server and the worker in separate terminals.

### Registering Task Modules

The worker only knows about tasks in the modules it imports. When you add a task module, add it to the list in `commands/queue_work_command.py`:

```python
# commands/queue_work_command.py
return subprocess.run([
    sys.executable, "-m", "taskiq", "worker", "worker:broker",
    "tasks.example_task", "tasks.reports",
    "--workers", str(workers),
], check=False).returncode
```

`queue:work` runs the TaskIQ worker CLI, so you may also run it directly with any of its options:

```bash
uv run taskiq worker worker:broker tasks.example_task tasks.reports
```

## Testing Tasks

Under pytest, the framework loads `.env.testing` on top of `.env`. Set the `memory` driver there, so dispatched tasks run in the test process without Redis or a worker:

```ini
# .env.testing
QUEUE_DRIVER=memory
```

The broker still has to be started before you dispatch:

```python
# tests/test_tasks.py
from fastapi_startkit.facades import Queue
from fastapi_startkit.testing import TestCase


class TestWelcomeEmail(TestCase):
    def get_application(self):
        from bootstrap.application import app

        return app

    async def test_send_welcome_email(self):
        from tasks.example_task import send_welcome_email

        await Queue.startup()
        task = await send_welcome_email.kiq("taylor@example.com", "Taylor")
        result = await task.wait_result(timeout=2)
        await Queue.shutdown()

        assert result.return_value["status"] == "sent"
```

See [Console](/docs/console) for writing your own commands and [Redis](/docs/redis) for using Redis directly.
