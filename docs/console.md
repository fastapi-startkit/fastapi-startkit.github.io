---
outline: deep
title: Console Commands
---

# Console Commands

FastAPI Startkit uses [Cleo](https://cleo.readthedocs.io/en/latest/) to provide a powerful command-line interface, inspired by Laravel's Artisan.

## Creating a Command

To create a new console command, define a class that inherits from `cleo.commands.command.Command`. You should specify the `name` of the command and implement the `handle` method.

```python
from cleo.commands.command import Command

class HelloCommand(Command):
    """
    Say hello from the console

    hello
    """
    name = "hello"

    def handle(self):
        self.line("<info>Hello Command</info>")
```

> [!TIP]
> You can also use docstrings to define the command's signature and description, which Cleo will automatically parse.

## Registering Commands

The recommended way to register commands is through a **Service Provider**. This keeps your command registration organized and decoupled from the main application logic.

### 1. Create a Service Provider

Create a service provider and use the `self.commands()` method within the `boot` or `register` method to register your command classes.

```python
from fastapi_startkit.providers import Provider
from app.console.commands.hello_command import HelloCommand

class ConsoleServiceProvider(Provider):
    def boot(self):
        # Register commands using the self.commands() helper
        self.commands([
            HelloCommand,
        ])
```

### 2. Register the Provider in your Application

Add your new provider to the `providers` list during application initialization (usually in `bootstrap/application.py`):

```python
from app.providers.console_service_provider import ConsoleServiceProvider

app = Application(
    base_path=str(Path().cwd()),
    providers=[
        # ... other providers
        ConsoleServiceProvider,
    ]
)
```

## Running the Command

Once registered, you can run your command using your CLI entry point script (e.g., `artisan`):

```bash
python artisan hello
```

To see a list of all available commands, simply run:

```bash
python artisan
```
