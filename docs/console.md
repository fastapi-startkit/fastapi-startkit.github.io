---
outline: deep
title: Console Commands
description: Write CLI commands with Cleo and run them through artisan.
keywords: cli, console, commands, automation, cleo
---

# Console Commands

Console commands are built on [Cleo](https://cleo.readthedocs.io/en/latest/) and run through your `artisan` script, as in Laravel.

## Creating a Command

A command is a class that extends `fastapi_startkit.console.Command`, a subclass of Cleo's `Command`. Set its `name` and `description`, declare any `arguments` or `options`, and put the work in `handle()`:

```python
from cleo.helpers import argument
from fastapi_startkit.console import Command
from fastapi_startkit.logging import Logger

class HelloCommand(Command):
    name = "hello"
    description = "Say hello from the console"

    arguments = [
        argument(
            "name",
            description="Who do you want to greet?",
            optional=True
        )
    ]

    def handle(self):
        name = self.argument('name')
        text = f"Hello {name}" if name else "Hello"

        Logger.info(f"Greeting: {text}")

        self.line(f"<info>{text}</info>")
```

## Registering Commands

Register commands from a service provider.

### 1. Create a Service Provider

Pass your command classes to `self.commands()` in the provider's `register()` or `boot()` method:

```python
from fastapi_startkit.support import Provider
from app.console.commands.hello_command import HelloCommand

class ConsoleServiceProvider(Provider):
    def boot(self):
        self.commands([
            HelloCommand,
        ])
```

### 2. Register the Provider in your Application

Add the provider to the `providers` list, usually in `bootstrap/application.py`:

```python
from app.providers.console_service_provider import ConsoleServiceProvider

app = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        # ... other providers
        ConsoleServiceProvider,
    ]
)
```

### 3. Handle Commands in Entry Point

Your `artisan` script hands the command line to `app.handle_command()`:

```python
#!/usr/bin/env python3
import sys
from bootstrap.application import app

if __name__ == "__main__":
    status = app.handle_command()
    sys.exit(status if isinstance(status, int) else 0)
```

## Running the Command

```bash
uv run python artisan hello
```

Run `artisan` with no arguments to list every command:

```bash
uv run python artisan
```

## Example Application

See the [console example app](https://github.com/fastapi-startkit/fastapi-startkit-modules/tree/main/example/console-app) for a complete project.
