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

# Introduction

FastAPI is a joy for building APIs quickly, but it deliberately leaves most application-level concerns up to you. Things like [environment management](/docs/configuration#loading-environment-variables) (including [multiple environments](/docs/configuration#choosing-the-environment-via-the-cli)), [logging](/docs/logging), [database](/docs/database/) setup, [configuration](/docs/configuration), [CLI commands](/docs/console), [storage](/docs/storage), [queues](/docs/queues), [cache](/docs/cache), [Redis](/docs/redis), and the rest of your infrastructure are yours to design and wire together.

We were building several microservices and kept copying the same bootstrap code from one project to the next. Before long, keeping all those copies consistent became a chore.

So we pulled that code out and open sourced it as FastAPI Startkit, an application framework that brings proven patterns from mature web frameworks to Python and FastAPI.

FastAPI Startkit isn't trying to replace FastAPI. It gives you a structured foundation for larger applications while staying modular, so you only pull in the components you need. In fact, you don't have to use FastAPI at all: you can build headless CLI utilities, cron scripts, or background workers and still use every one of the infrastructure components.

Out of the box, you get:

- Logging
- Async database ORM, migrations & seeders
- CLI console commands
- Service providers
- Queue workers with TaskIQ
- FastAPI integration & routing
- Frontend integration (Vite & Inertia)

You build an application by registering providers. Pick the ones you need and hand them to the `Application`. This is the `bootstrap/application.py` the installer writes for a web app with SQLite and React:

```python
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.inertia import InertiaProvider
from fastapi_startkit.logging import LogProvider
from fastapi_startkit.masoniteorm import DatabaseProvider
from fastapi_startkit.vite import ViteProvider

from config.app import AppConfig
from config.database import DatabaseConfig
from config.fastapi import FastAPIConfig
from config.logging import LoggingConfig
from config.vite import ViteConfig

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    config=AppConfig,
    providers=[
        (LogProvider, LoggingConfig),
        (DatabaseProvider, DatabaseConfig),
        (FastAPIProvider, FastAPIConfig),
        (ViteProvider, ViteConfig),
        InertiaProvider,
    ],
)
```

A provider can be listed on its own, or paired with a config class as a `(Provider, Config)` tuple when it needs configuration. The `config` modules live in your project. Adding a capability means adding a provider to that list, for example `StorageProvider`, `CacheProvider`, `RedisProvider`, `ReverbProvider` or `McpProvider`. The configuration, event and application providers are always registered, so you don't list them. For a real-world example, see the [Keera Agent `bootstrap/application.py`](https://github.com/Keera-Labs/keera-agent/blob/main/bootstrap/application.py#L23-L39).

The quickest way to get going is the `fastapi-startkit init` installer, which creates a ready-to-run project. If you'd like to see what it generates, the manual setup further down walks through it.

## Creating a Project

Run one command in a terminal:

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

The command installs [uv](https://docs.astral.sh/uv/) if you don't have it yet, then runs the latest FastAPI Startkit installer. Nothing else is installed on your system.

The installer asks a few questions. Press Enter to accept the default:

| Question | Choices | Default |
|---|---|---|
| Where should the project be created? | A new or empty directory | `example-project` |
| Which services should your application run? | Web (FastAPI routes and a health check), Worker (TaskIQ background jobs with a Redis broker) | Web |
| Which database will your application use? | None, SQLite, PostgreSQL, MySQL | SQLite |
| Which frontend would you like to install? | None (API only), React or Vue (Inertia, TypeScript and Tailwind) | None |

Worker-only projects skip the frontend question. The installer then shows the files it will create, asks you to confirm, writes the project and installs its dependencies:

```text
Your application is ready.
Run: uv run python artisan serve
Migrate: uv run python artisan db:migrate
```

Start the server:

```bash
cd example-project
uv run python artisan serve
```

Open http://127.0.0.1:8000 for the welcome response and `/health` for the health check. Run the generated tests with `uv run pytest`.

### Installer options

To skip questions, add the directory and options after the command:

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
| `--app` | `web`, `worker` or `both` |
| `--database` | `none`, `sqlite`, `postgres` or `mysql` |
| `--frontend` | `none`, `react` or `vue` |
| `--dry-run` | Show the files and dependencies without creating anything |
| `--no-deps` | Generate files without running `uv sync` |
| `--no-interaction` / `-n` | Use the defaults for options you didn't pass, for example in scripts or CI |

The directory must be new or empty. The install scripts always use the latest release; to use a specific one, set `FASTAPI_STARTKIT_VERSION`, for example `FASTAPI_STARTKIT_VERSION=0.67.0` on macOS and Linux or `$env:FASTAPI_STARTKIT_VERSION = "0.67.0"` in PowerShell.

With PostgreSQL or MySQL, set the credentials in `.env` and start the database server before running `uv run python artisan db:migrate`. With React or Vue, install Node.js 22.12 or newer and run `npm install && npm run dev` in a second terminal.

## Getting Started Using AI

If you use a coding agent, it can scaffold the project for you. Open the agent in an empty directory and paste this prompt:

```text
Scaffold a new Python project using the FastAPI Startkit framework
(https://pypi.org/project/fastapi-startkit/, docs at https://fastapi-startkit.github.io).

Requirements:
1. Use `uv` for environment and dependency management. Target Python 3.12+.
   Run `uv init` and add the framework with `uv add "fastapi-startkit[fastapi]"`.
2. Use the recommended structured (provider-driven) layout, not the single-file setup:
   .
   ├── artisan                  # CLI entry point
   ├── bootstrap/
   │   └── application.py       # builds the Application with its providers
   ├── config/
   └── app/
3. In `bootstrap/application.py`, create the `Application` with `base_path` set to the
   project root and register `FastAPIProvider` from `fastapi_startkit.fastapi`.
4. Make `artisan` an executable script that imports `app` from `bootstrap.application`
   and calls `app.handle_command()`, exiting with its status code.
5. Verify the server boots with `uv run python artisan serve`.

Follow the conventions in the FastAPI Startkit "Getting Started" guide. Keep the code
clean and minimal — register only what the requirements ask for.
```

The agent installs the framework, creates the directories, and leaves you with an application that runs.

## Manual Setup

If you're adding the framework to an existing project, or you'd rather wire the application up yourself, follow the steps below.

### Prerequisites

You need Python, and we recommend uv.

#### 1. Python
FastAPI Startkit supports Python 3.12, 3.13, 3.14 and 3.15. You can download it from [python.org](https://www.python.org/downloads/), or, if you already have uv installed, run:

```bash
uv python install 3.12
```

#### 2. uv (Recommended)
The examples on this site use [uv](https://docs.astral.sh/uv/) to manage packages and virtual environments. Install it with:

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Installation

Install the package with uv or pip:

```bash
uv add "fastapi-startkit[fastapi]"
# or
pip install "fastapi-startkit[fastapi]"
```

> Python 3.12, 3.13, 3.14 and 3.15 are supported. The `fastapi-startkit[ai]` extra cannot be installed on Python 3.15 or newer yet, because its `langgraph` dependency requires `ormsgpack`, which does not support 3.15. Use Python 3.14 or older for the `ai` extra.

Create a `.env` file in the project root that sets the environment:

```ini
APP_ENV=local
```

### Way 1: Simple Setup

For a small project or a prototype, you can put everything in a single file, such as `main.py`:

```python
from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

providers = [
    FastAPIProvider
]

app: Application = Application(
    base_path=Path(__file__).parent,
    providers=providers
)

if __name__ == "__main__":
    app.handle_command()
```

`FastAPIProvider` creates the FastAPI instance, binds it into the service container, and registers the `serve` command.

#### Running the server

Start the server with `serve`:

```bash
uv run python main.py serve
```

### Way 2: Structured Setup

As your application grows, you'll want to split the code the way `fastapi-startkit init` does: a bootstrap file, config classes, and providers.

#### Option A: Use the Boilerplate Repository

Clone the boilerplate and you'll start with FastAPI, logging, and the database already configured:

```bash
git clone https://github.com/fastapi-startkit/fastapi_startkit my-project
cd my-project
uv sync
```

#### Option B: Manual Setup

Create this layout:

```text
.
├── artisan
├── bootstrap/
│   └── application.py
├── config/
└── app/
```

Create the application in `bootstrap/application.py`:

```python
from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

app: Application = Application(
    base_path=Path(__file__).parent.parent,
    providers=[FastAPIProvider]
)
```

Then add an `artisan` script as the CLI entry point:

```python
#!/usr/bin/env python3
import sys
from bootstrap.application import app

if __name__ == "__main__":
    status = app.handle_command()
    sys.exit(status if isinstance(status, int) else 0)
```

#### Running the server

Run commands through `artisan`:

```bash
uv run python artisan serve
```

## Running with Uvicorn

When you want to pass your own Uvicorn flags, for example in production, point Uvicorn at the app instance. Calling `app` returns the FastAPI instance, so add `--factory`:

```bash
uv run uvicorn bootstrap.application:app --factory --reload
```
