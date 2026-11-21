---
outline: deep
title: Getting Started
description: Create a FastAPI Startkit application with uvx fastapi-startkit init, or set one up by hand.
keywords: fastapi, starter, framework, python, tutorial
jsonLd:
  "@type": "TechArticle"
  "headline": "Getting Started with FastAPI Startkit"
  "description": "How to install FastAPI Startkit and set up a new Python project."
  "articleSection": "Guide"
  "author":
    "@type": "Organization"
    "name": "FastAPI Startkit Team"
---

# Getting Started

FastAPI Startkit is an application framework for Python. It gives a FastAPI project the pieces FastAPI leaves to you: [configuration](/docs/configuration) and environment files, [logging](/docs/logging), an async [database ORM](/docs/database/) with migrations, [console commands](/docs/console), [storage](/docs/storage), [queues](/docs/queues), [cache](/docs/cache) and [Redis](/docs/redis).

Each feature is a provider that you register with the application, so you only install what you use. You don't have to serve HTTP at all: a CLI tool, a cron script or a background worker can use the same providers.

## Creating a Project

The `fastapi-startkit init` installer creates a ready-to-run project. Run one command in a terminal:

::: code-group

```bash [macOS / Linux]
/bin/bash -c "$(curl -fsSL https://fastapi-startkit.github.io/install.sh)"
```

```powershell [Windows]
powershell -ExecutionPolicy ByPass -c "irm https://fastapi-startkit.github.io/install.ps1 | iex"
```

```bash [Existing uv]
uvx fastapi-startkit@latest init
```

:::

The script installs [uv](https://docs.astral.sh/uv/) if you don't have it, then runs the latest installer with `uv tool run`. The installer asks a few questions. Press Enter to accept the default:

| Question | Choices | Default |
|---|---|---|
| Where should the project be created? | A new or empty directory | `example-project` |
| Which services should your application run? | Web (FastAPI routes and a health check), Worker (TaskIQ background jobs with a Redis broker) | Web |
| Which database will your application use? | None, SQLite, PostgreSQL, MySQL | SQLite |
| Which frontend would you like to install? | None (API only), React or Vue (Inertia, TypeScript and Tailwind) | None |

Worker-only projects skip the frontend question. The installer lists the files it will create, asks you to confirm, writes the project and runs `uv sync`. Then start the server:

```bash
cd example-project
uv run python artisan serve
```

With PostgreSQL or MySQL, set the credentials in `.env` and start the database server, then run `uv run python artisan db:migrate`.

With React or Vue, install Node.js 22.12 or newer and start Vite in a second terminal before you open the home page. Until Vite has run, `/` returns a 500 error because the Vite manifest is missing:

```bash
npm install && npm run dev
```

Open http://127.0.0.1:8000 for the home page and http://127.0.0.1:8000/health for the health check, which returns `{"status": "ok"}`. An API-only project returns a JSON welcome response on `/`, and a React or Vue project renders its Inertia page. Run the generated tests with `uv run pytest`.

### Installer Options

To skip the questions, pass the directory and options after the command:

::: code-group

```bash [macOS / Linux]
curl -fsSL https://fastapi-startkit.github.io/install.sh | bash -s -- my-app --database=postgres
```

```powershell [Windows]
& ([scriptblock]::Create((irm https://fastapi-startkit.github.io/install.ps1))) my-app --database=postgres
```

```bash [Existing uv]
uvx fastapi-startkit@latest init my-app --database=postgres
```

:::

| Option | Values |
|---|---|
| `--app` | `web` (default), `worker` or `both` |
| `--database` | `none`, `sqlite` (default), `postgres` or `mysql` |
| `--frontend` | `none` (default), `react` or `vue`. Not allowed with `--app=worker` |
| `--dry-run` | List the files and dependencies without creating anything |
| `--no-deps` | Write the files without running `uv sync` |
| `--no-interaction`, `-n` | Use the defaults for options you didn't pass. The directory argument is required |

Pass `.` as the directory to create the project in the current empty directory, for example `uvx fastapi-startkit init . -n`. Run `uvx fastapi-startkit init --help` for the full reference.

The install scripts use the latest release. To pin one, set `FASTAPI_STARTKIT_VERSION`, for example `FASTAPI_STARTKIT_VERSION=0.78.0` on macOS and Linux or `$env:FASTAPI_STARTKIT_VERSION = "0.78.0"` in PowerShell.

## Registering Providers

An application is an `Application` instance and the list of providers it boots. This is the `bootstrap/application.py` the installer writes for a web app with SQLite and React:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.logging import LogProvider
from config.app import AppConfig
from config.logging import LoggingConfig
from fastapi_startkit.masoniteorm import DatabaseProvider
from config.database import DatabaseConfig
from config.fastapi import FastAPIConfig
from providers.fastapi_provider import FastapiProvider
from fastapi_startkit.inertia import InertiaProvider
from fastapi_startkit.vite import ViteProvider
from config.vite import ViteConfig

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    config=AppConfig,
    providers=[
        (LogProvider, LoggingConfig),
        (DatabaseProvider, DatabaseConfig),
        (FastapiProvider, FastAPIConfig),
        (ViteProvider, ViteConfig),
        InertiaProvider,
    ],
)
```

List a provider on its own, or pair it with a config class as a `(Provider, Config)` tuple. The config classes live in your project's `config/` directory, and `FastapiProvider` in `providers/` extends the framework's `FastAPIProvider` to register your routes. See [FastAPI](/docs/fastapi) for how that works.

To add a feature, add its provider to the list, for example `StorageProvider`, `CacheProvider`, `RedisProvider`, `ReverbProvider` or `McpProvider`. The configuration, event and application providers are always registered, so you don't list them.

## Getting Started Using AI

A coding agent can scaffold the project for you. Open the agent in an empty directory and paste this prompt:

```text
Scaffold a new Python project with the FastAPI Startkit framework
(https://pypi.org/project/fastapi-startkit/, docs at https://fastapi-startkit.github.io).

1. Install uv if it is missing, then run
   `uvx fastapi-startkit@latest init . --no-interaction` in this empty directory.
   Add `--database=postgres`, `--database=mysql` or `--database=none` if I asked for
   another database, and `--frontend=react` or `--frontend=vue` if I asked for a frontend.
2. Start the server with `uv run python artisan serve` and check that
   http://127.0.0.1:8000/health returns {"status": "ok"}.
3. Run the generated tests with `uv run pytest`.

Follow the conventions in the FastAPI Startkit "Getting Started" guide and keep the
generated layout: bootstrap/, config/, providers/, routes/ and app/.
```

## Manual Setup

Set the application up by hand when you add the framework to an existing project.

### Installing the Package

The framework supports Python 3.12 or newer. Install it with the `fastapi` extra:

```bash
uv add "fastapi-startkit[fastapi]"
# or
pip install "fastapi-startkit[fastapi]"
```

If you don't have Python yet, `uv python install 3.12` installs it.

The application reads `APP_ENV` when it boots. Without a `.env` file it raises `ValueError: Unable to determine environment.`, and with a `.env` file that doesn't set `APP_ENV` it raises `ValueError: APP_ENV not set after loading .env`. Create a `.env` file in the project root:

```ini
# .env
APP_ENV=local
```

See [Configuration](/docs/configuration) for how environment files are loaded.

### A Single-File Application

For a prototype, put the application in one file. The `Application` instance exposes FastAPI's route decorators:

```python
# main.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

app = Application(
    base_path=Path(__file__).parent,
    providers=[FastAPIProvider],
)


@app.get("/")
async def index():
    return {"message": "Hello from FastAPI Startkit"}


if __name__ == "__main__":
    app.handle_command()
```

`app.handle_command()` runs the console, and `FastAPIProvider` registers the `serve` command. Pass `--app` so the server can reload your module when it changes:

```bash
uv run python main.py serve --app=main:app
```

### A Structured Application

As the application grows, use the layout the installer creates:

```text
.
├── artisan
├── bootstrap/
│   └── application.py
├── config/
├── providers/
├── routes/
└── app/
```

Create the application in `bootstrap/application.py`:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[FastAPIProvider],
)
```

Then add an `artisan` script in the project root as the console entry point:

```python
#!/usr/bin/env python3
# artisan
import sys

from bootstrap.application import app

if __name__ == "__main__":
    sys.exit(app.handle_command())
```

Run every command through `artisan`:

```bash
uv run python artisan serve
```

## Running with Uvicorn

To pass your own Uvicorn flags, for example in production, point Uvicorn at the application. Calling `app` returns the FastAPI instance, so add `--factory`:

```bash
uv run uvicorn bootstrap.application:app --factory --host 0.0.0.0 --port 8000
```
