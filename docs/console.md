---
outline: deep
title: Console Commands
description: Write CLI commands with Cleo, run them through artisan, and use the built-in commands.
keywords: cli, console, commands, automation, cleo, artisan
---

# Console Commands

Not everything your application does happens in an HTTP request. Data imports, cleanup jobs and maintenance tasks are easier to run from the terminal. The framework lets you write these as console commands, built on [Cleo](https://cleo.readthedocs.io/en/latest/), and run them through your application's `artisan` script. It also ships commands for migrations, code generation and serving your application.

- [Running Commands](#running-commands)
- [Creating a Command](#creating-a-command)
- [Registering Commands](#registering-commands)
- [Calling Commands From Code](#calling-commands-from-code)
- [Built-In Commands](#built-in-commands)

## Running Commands

Run a command by passing its name to `artisan`:

```bash
uv run python artisan db:migrate
```

Run `artisan` with no arguments to list every registered command, and add `--help` to a command to see its arguments and options:

```bash
uv run python artisan
uv run python artisan db:migrate --help
```

To run a command against another environment, add `--env`. See [Configuration](/docs/configuration#choosing-the-environment-via-the-cli).

## Creating a Command

A command is a class that extends `fastapi_startkit.console.Command`. Give it a `name` and a `description`, declare the `arguments` and `options` it accepts, and put the work in `handle()`. The value `handle()` returns becomes the command's exit code:

```python
# app/console/commands/send_digest_command.py
from cleo.helpers import argument, option

from fastapi_startkit.console import Command
from fastapi_startkit.logging import Log


class SendDigestCommand(Command):
    name = "digest:send"
    description = "Send the weekly digest email to a user"

    arguments = [
        argument("email", description="The user's email address"),
    ]

    options = [
        option("dry-run", None, description="Print the digest without sending it", flag=True),
        option("limit", "l", description="Maximum number of posts to include", flag=False, default="10"),
    ]

    def handle(self) -> int:
        email = self.argument("email")
        limit = int(self.option("limit"))

        if self.option("dry-run"):
            self.line(f"<comment>Would send {limit} posts to {email}</comment>")
            return 0

        Log.info(f"Sending digest to {email}")
        self.line(f"<info>Digest sent to {email}</info>")
        return 0
```

Once it's [registered](#registering-commands), you can run it:

```bash
uv run python artisan digest:send taylor@example.com --dry-run --limit=5
# Would send 5 posts to taylor@example.com
```

### Arguments and Options

`argument()` and `option()` come from `cleo.helpers`:

- `argument(name, description=..., optional=False, multiple=False, default=None)` declares a positional argument. Read it with `self.argument("email")`.
- `option(long_name, short_name=None, description=..., flag=True, value_required=True, multiple=False, default=None)` declares an `--option`. With `flag=True` the option is a switch that reads as `True` or `False`. With `flag=False` it takes a value, such as `--limit=5`. Read it with `self.option("limit")`.

Option values are strings, so convert them yourself, as `int(self.option("limit"))` does above. Running a command without a required argument prints a traceback that ends with `Not enough arguments (missing: "email")`.

Every command also accepts `-C/--config`, which the framework doesn't read. Leave it unset.

### Writing Output and Asking Questions

Commands inherit Cleo's output and input helpers:

| Method | Description |
|---|---|
| `self.line(text)` | Writes a line. Wrap text in `<info>`, `<comment>`, `<question>` or `<error>` tags to colour it. |
| `self.info(text)` | Writes a line in the `info` style. |
| `self.comment(text)` | Writes a line in the `comment` style. |
| `self.line_error(text)` | Writes a line to stderr. |
| `self.confirm(question, default=False)` | Asks a yes or no question and returns a `bool`. |
| `self.ask(question, default=None)` | Asks for a value and returns the answer. |
| `self.choice(question, choices, default=None)` | Asks the user to pick from a list. |
| `self.table(header, rows)` | Builds a table. Call `.render()` on the result to print it. |

When a command runs without a terminal, for example in a cron job or with `--no-interaction`, the questions return their default.

### Running Async Code

`handle()` is a regular function, while models and most services are async. Run async work with `asyncio.run()`:

```python
# app/console/commands/prune_drafts_command.py
import asyncio

from fastapi_startkit.console import Command

from app.models.Post import Post


class PruneDraftsCommand(Command):
    name = "posts:prune-drafts"
    description = "Delete every draft post"

    def handle(self) -> int:
        if not self.confirm("Delete every draft post?", default=False):
            self.comment("Nothing deleted.")
            return 1

        deleted = asyncio.run(self.prune())
        self.info(f"Deleted {deleted} drafts.")
        return 0

    async def prune(self) -> int:
        count = await Post.where("status", "draft").count()
        await Post.where("status", "draft").delete()
        return count
```

This example needs a database connection. See [Database](/docs/database/).

## Registering Commands

Register your commands from a service provider by passing the classes to `self.commands()`:

```python
# app/providers/console_service_provider.py
from fastapi_startkit.support import Provider

from app.console.commands.prune_drafts_command import PruneDraftsCommand
from app.console.commands.send_digest_command import SendDigestCommand


class ConsoleServiceProvider(Provider):
    def boot(self):
        self.commands([
            SendDigestCommand,
            PruneDraftsCommand,
        ])
```

Then add the provider to your application:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.logging import LogProvider
from fastapi_startkit.masoniteorm import DatabaseProvider

from app.providers.console_service_provider import ConsoleServiceProvider

app = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        LogProvider,
        DatabaseProvider,
        ConsoleServiceProvider,
    ],
)
```

`LogProvider` backs the `Log` calls in `digest:send`, and `DatabaseProvider` backs the `Post` queries in `posts:prune-drafts`.

### The `artisan` Script

The `artisan` script in your project root hands the command line to `app.handle_command()` and exits with the command's exit code:

```python
#!/usr/bin/env python3
# artisan
import sys

from bootstrap.application import app

if __name__ == "__main__":
    sys.exit(app.handle_command())
```

## Calling Commands From Code

To run a command from your own code, such as a scheduled job or a test, call `app.run()` with the command name and its arguments. It returns the exit code:

```python
from bootstrap.application import app

status = app.run("digest:send", ["taylor@example.com", "--dry-run"])
# Would send 10 posts to taylor@example.com

status = app.run("digest:send", "taylor@example.com --limit=3")
```

The arguments can be a list or a single string.

## Built-In Commands

The framework's providers register these commands for you. The `provider:publish` and `db:install` commands are always available. The others appear once you register their provider.

| Command | Provider | Description |
|---|---|---|
| `provider:publish` | Always available | Copies provider config files into your project. `--provider=logging` publishes one provider's files. |
| `db:install` | Always available | Publishes `config/database.py` and registers `DatabaseProvider`. `--driver` picks the database driver, `sqlite` by default. |
| `serve` | `FastAPIProvider` | Starts the development server. Accepts `--host`, `--port`, `--reload`, `--app` and `--ws`. |
| `make:notification` | `NotificationProvider` | Creates a notification class in `app/notifications`. See [Notifications](/docs/notifications). |
| `ai:skills` | `AISkillProvider` | Lists or syncs the AI skills that providers declare. See [AI Skills](/docs/ai/skills). |

### Database Commands

`DatabaseProvider` registers these commands. See [Migrations](/docs/database/migrations) and [Seeding](/docs/database/seeds) for how to use them.

| Command | Description |
|---|---|
| `db:migrate` | Runs the pending migrations. |
| `db:migrate:status` | Shows which migrations have run. |
| `db:migrate:rollback` | Rolls back the last batch of migrations. |
| `db:migrate:refresh` | Rolls back every migration, then runs them all again. |
| `db:migrate:fresh` | Drops every table, then runs all migrations. |
| `db:seed` | Runs your seeders. |
| `db:make:migration` | Creates a migration file. `--create=posts` starts a new table, `--table=posts` alters one. |
| `db:make:model` | Creates a model file. `-m` also creates a migration, `-s` a seeder. |
| `db:make:observer` | Creates a model observer in `app/observers`. |
| `seed` | Creates a seeder file in `databases/seeders`. |

`db:migrate:refresh` and `db:migrate:fresh` accept `--seed` to run seeders afterwards. Pass a table name, such as `--seed=users` to run `UsersTableSeeder`, or `--seed=null` to run `DatabaseSeeder`.

`db:make:observer` takes the observer's name and an optional `--model`:

```bash
uv run python artisan db:make:observer User --model=User
# Observer created: UserObserver.py
```

The file contains an async method for each model event, such as `creating`, `updated` and `deleted`.

### Registering the Shell and Reset Commands

Two database commands aren't registered by `DatabaseProvider`:

- `shell` opens your database's own command-line client (`sqlite3`, `psql`, `mysql` or `sqlcmd`) using the connection settings from your config. `--connection` picks a connection other than the default, and `--show=1` prints the client command, with the password hidden, before running it. `--show` needs a value. The client must be installed and on your `PATH`.
- `db:migrate:reset` rolls back every migration without running them again.

To use them, import them from `fastapi_startkit.masoniteorm.commands` and register them in your own provider:

```python
# app/providers/console_service_provider.py
from fastapi_startkit.masoniteorm.commands import MigrateResetCommand, ShellCommand
from fastapi_startkit.support import Provider


class ConsoleServiceProvider(Provider):
    def boot(self):
        self.commands([
            MigrateResetCommand,
            ShellCommand,
        ])
```

```bash
uv run python artisan db:migrate:reset
uv run python artisan shell
```

For a complete project, see the [console example app](https://github.com/fastapi-startkit/fastapi-startkit-modules/tree/main/example/console-app).
