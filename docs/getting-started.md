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

You build an application by registering providers. Pick the ones you need and hand them to the `Application`:

```python
from pathlib import Path
from fastapi_startkit import Application

app = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        LogProvider,
        (DatabaseProvider, DatabaseConfig),
        (FastAPIProvider, FastAPIConfig),
        McpProvider,
        AISkillProvider,
        (StorageProvider, StorageConfig),
        AppProvider,
        PluginProvider,
        TerminalProvider,
        (ViteProvider, ViteConfig),
        InertiaProvider,
        (ReverbProvider, BroadcastingConfig),
    ],
)
```

A provider can be listed on its own, or paired with a config object as a `(Provider, Config)` tuple when it needs configuration. Adding a capability means adding a provider to that list. For a real-world example, see the [Keera Agent `bootstrap/application.py`](https://github.com/Keera-Labs/keera-agent/blob/main/bootstrap/application.py#L23-L39).

The quickest way to get going is the `fastapi-startkit init` installer, which creates a ready-to-run project. If you'd like to see what it generates, the manual setup further down walks through it.

## Creating a Project

::: code-group

```bash [macOS / Linux]
/bin/bash -c "$(curl -fsSL https://fastapi-startkit.github.io/install.sh)"
```

```powershell [Windows]
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
uvx fastapi-startkit init my-app
```

```bash [Existing uv]
uvx fastapi-startkit init my-app
```

:::

On macOS and Linux the script installs [uv](https://docs.astral.sh/uv/) when it is missing and then starts the installer. Arguments are passed through, for example `curl -fsSL https://fastapi-startkit.github.io/install.sh | bash -s -- my-app`, and `FASTAPI_STARTKIT_VERSION=0.67.0` pins a release. On Windows, install uv first, then open a new terminal if `uvx` is not found.

`uvx` runs the installer without adding anything to your system. Leave out `my-app` and it asks where to create the project. In a terminal, it then asks:

| Question | Choices | Default |
|---|---|---|
| Which services should your application run? | Web (FastAPI routes and a health check), Worker (TaskIQ background jobs with a Redis broker) | Web |
| Which database will your application use? | None, SQLite, PostgreSQL, MySQL | SQLite |
| Which frontend would you like to install? | None (API only), React or Vue (Inertia, TypeScript and Tailwind) | None |

The frontend question is skipped for worker-only projects. The installer then lists the files it will create, asks for confirmation, writes the project and runs `uv sync` to install dependencies:

```text
Your application is ready.
Run: uv run python artisan serve
Migrate: uv run python artisan db:migrate
```

Start the server:

```bash
cd my-app
uv run python artisan serve
```

Open http://127.0.0.1:8000 for the welcome response and `/health` for the health check. Run the generated tests with `uv run pytest`.

### Installer options

Pass options to skip the questions, for example in scripts or CI:

```bash
uvx fastapi-startkit init my-app --app=web --database=postgres --frontend=react --no-interaction
```

| Option | Values |
|---|---|
| `--app` | `web`, `worker` or `both` |
| `--database` | `none`, `sqlite`, `postgres` or `mysql` |
| `--frontend` | `none`, `react` or `vue` |
| `--dry-run` | Show the files and dependencies without creating anything |
| `--no-deps` | Generate files without running `uv sync` |
| `--no-interaction` / `-n` | Use the defaults for options you didn't pass |

The directory must be new or empty. `uvx` reuses the version it cached first; run `uvx fastapi-startkit@latest init my-app` to make sure you get the newest release.

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
