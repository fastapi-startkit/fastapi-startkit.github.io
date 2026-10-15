---
outline: deep
title: Getting Started
description: Install Fastapi Startkit and set up your first application.
keywords: fastapi, starter, framework, python, tutorial
jsonLd:
  "@type": "TechArticle"
  "headline": "Getting Started with Fastapi Startkit"
  "description": "How to install Fastapi Startkit and set up a new Python project."
  "articleSection": "Guide"
  "author":
    "@type": "Organization"
    "name": "Fastapi Startkit Team"
---

# Introduction

FastAPI handles routing and validation, and leaves the rest of the application to you: environment files, configuration, logging, the database, CLI commands, storage. We kept copying the same bootstrap code between our microservices, so we extracted it into Fastapi Startkit, an application framework modelled on Laravel.

Fastapi Startkit doesn't replace FastAPI, and it doesn't require it. You can build a CLI tool, a cron script, or a queue worker with the same components and no HTTP server.

The framework includes:

- Logging
- An async ORM with migrations and seeders
- Console commands
- Service providers
- Queue workers on TaskIQ
- FastAPI integration and routing
- Frontend integration with Vite and Inertia

You build an application by passing the providers you need to `Application`:

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

List a provider on its own, or pair it with a config class as a `(Provider, Config)` tuple. To add a feature, add its provider. For a real application, see the [Keera Agent `bootstrap/application.py`](https://github.com/Keera-Labs/keera-agent/blob/main/bootstrap/application.py#L23-L39).

## Getting Started Using AI

If you use a coding agent, it can scaffold the project for you. Open the agent in an empty directory and paste this prompt:

```text
Scaffold a new Python project using the Fastapi Startkit framework
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

Follow the conventions in the Fastapi Startkit "Getting Started" guide. Keep the code
clean and minimal — register only what the requirements ask for.
```

The agent installs the framework, creates the directories, and leaves you with an application that runs. The rest of this page does the same setup by hand.

## Prerequisites

You need Python, and we recommend uv.

### 1. Python
Fastapi Startkit supports **Python 3.12, 3.13, 3.14 and 3.15**. You can download it from [python.org](https://www.python.org/downloads/), or if you have **uv** installed, simply run:

```bash
uv python install 3.12
```

### 2. uv (Recommended)
The examples on this site use [uv](https://docs.astral.sh/uv/) to manage packages and virtual environments. Install it with:

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

## Installation

Install the package with uv or pip:

```bash
uv add fastapi-startkit
# or
pip install fastapi-startkit
```

> Python 3.12, 3.13, 3.14 and 3.15 are supported. The `fastapi-startkit[ai]` extra cannot be installed on Python 3.15 or newer yet, because its `langgraph` dependency requires `ormsgpack`, which does not support 3.15. Use Python 3.14 or older for the `ai` extra.

## Way 1: Simple Setup

For a small project or a prototype, put everything in one file, such as `main.py`:

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

### Running the server

Start the server with `serve`:

```bash
uv run python main.py serve
```

## Way 2: Structured Setup (Recommended)

For a larger application, split the code into a bootstrap file, config classes, and providers.

### Option A: Use the Boilerplate Repository

Clone the boilerplate to start with FastAPI, logging, and the database already configured:

```bash
git clone https://github.com/fastapi-startkit/fastapi_startkit my-project
cd my-project
uv sync
```

### Option B: Manual Setup

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

### Running the server

Run commands through `artisan`:

```bash
uv run python artisan serve
```

## Running with Uvicorn

To pass your own Uvicorn flags, for example in production, point Uvicorn at the app instance. Calling `app` returns the FastAPI instance, so add `--factory`:

```bash
uv run uvicorn bootstrap.application:app --factory --reload
```
