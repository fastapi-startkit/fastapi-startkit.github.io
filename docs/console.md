---
outline: deep
title: Console Commands
---

# Console Commands

Fastapi Startkit uses [Cleo](https://cleo.readthedocs.io/en/latest/) to provide a powerful command-line interface, inspired by Laravel's Artisan.

## Creating a Command

To create a new console command, define a class that inherits from `cleo.commands.command.Command`. You should specify the `name`, `description`, and any `arguments` or `options`.

```python
from cleo.commands.command import Command
from cleo.helpers import argument
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
        
        # You can use the Logger facade within your commands
        Logger.info(f"Greeting: {text}")
        
        self.line(f"<info>{text}</info>")
```


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
    base_path=Path(__file__).parent.parent,
    providers=[
        # ... other providers
        ConsoleServiceProvider,
    ]
)
```

### 3. Handle Commands in Entry Point

In your CLI entry point (e.g., `artisan`), use the `handle_command()` method of the `Application` instance:

```python
#!/usr/bin/env python3
import sys
from bootstrap.application import app

if __name__ == "__main__":
    status = app.handle_command()
    sys.exit(status if isinstance(status, int) else 0)
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

## Example Application

You can find a complete example of a Console application built with Fastapi Startkit in our [example repository](https://github.com/fastapi-startkit/fastapi-startkit-modules/tree/main/example/console-app).
