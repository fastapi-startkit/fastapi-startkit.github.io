---
outline: deep
title: Getting Started
description: Get up and running with Fastapi Startkit in minutes.
keywords: fastapi, starter, framework, python, tutorial
jsonLd:
  "@type": "TechArticle"
  "headline": "Getting Started with Fastapi Startkit"
  "description": "A comprehensive guide to installing and setting up Fastapi Startkit for your next Python project."
  "articleSection": "Guide"
  "author":
    "@type": "Organization"
    "name": "Fastapi Startkit Team"
---

# Introduction

FastAPI is excellent for quickly building APIs, but it intentionally leaves many application-level concerns to the developer. Things like environment management (including multiple environments), logging, database setup, configuration, CLI commands, storage, and other infrastructure are things you typically need to design and wire together yourself.

In our case, we were building multiple microservices, and we found ourselves repeatedly copying the same bootstrap code between projects. Over time, that became repetitive and harder to maintain consistently.

So we decided to open source it as FastAPI Startkit, an application framework that brings proven patterns from mature web frameworks into Python and FastAPI.

The goal is not to replace FastAPI. Instead, it provides a structured foundation for building larger applications while staying modular — you can use only the components you need. That said, **it doesn't enforce you to use FastAPI at all** — you can build entirely headless CLI utilities, cron scripts, or background task workers and still get access to the full suite of infrastructure components.

Some features include:

- 🪵 Logging
- 🗄️ Async database ORM, migrations & seeders
- 🖥️ CLI console commands
- 🧩 Service providers
- 🧵 Queue workers with TaskIQ
- ⚡ FastAPI integration & routing
- 🎨 Frontend integration (Vite & Inertia)

An application is composed by **registering providers** — you pick the ones you need and hand them to the `Application`:

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

A provider can be listed on its own, or paired with a config object as a `(Provider, Config)` tuple when it needs configuration. Adding a capability is as simple as adding a provider to that list. For a real-world example, see the [Keera Agent `bootstrap/application.py`](https://github.com/Keera-Labs/keera-agent/blob/main/bootstrap/application.py#L23-L39).

The sections below walk you through installing the framework and standing up your first application.

## Getting Started Using AI

If you use an AI coding agent — [Claude Code](https://www.anthropic.com/claude-code), Cursor, GitHub Copilot, Windsurf, or similar — you can scaffold a fully structured Fastapi Startkit project without running any of the manual steps below yourself. Open your agent in an empty project directory and paste the prompt:

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

The agent will install the framework, generate the directory structure, and produce a runnable application. The sections below walk through the same setup manually if you'd rather do it by hand.

## Prerequisites

Before installing Fastapi Startkit, ensure you have the following installed:

### 1. Python
Fastapi Startkit requires **Python 3.12** or higher. You can download it from [python.org](https://www.python.org/downloads/), or if you have **uv** installed, simply run:

```bash
uv python install 3.12
```

### 2. uv (Recommended)
We highly recommend using [uv](https://docs.astral.sh/uv/) for package management. It is an extremely fast Python package manager and resolver.

**Installation:**
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

## Installation

You can install Fastapi Startkit using `uv` or `pip`:

```bash
uv add fastapi-startkit
# or
pip install fastapi-startkit
```

## Way 1: Simple Setup

For small projects or quick prototypes, you can define everything in a single file (e.g., `main.py`).

```python
from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

# Define providers
providers = [
    FastAPIProvider
]

# Initialize Application
app: Application = Application(
    base_path=Path(__file__).parent.parent,
    providers=providers
)

if __name__ == "__main__":
    app.handle_command()
```
The `FastAPIProvider` handles the initialization of the FastAPI instance, binds it to the service container, and automatically registers essential CLI commands and application routes.

### Running the server
This setup registers a `serve` command automatically. You can run it directly:

```bash
uv run python main.py serve
```

## Way 2: Structured Setup (Recommended)

For larger applications, we recommend a layered, provider-driven structure for better organization and maintainability.

### Option A: Use the Boilerplate Repository
The fastest way to get a fully configured project (including FastAPI, logging, database support, etc.) is to clone our official boilerplate:

```bash
git clone https://github.com/fastapi-startkit/fastapi_startkit my-project
cd my-project
uv sync
```

### Option B: Manual Setup
If you prefer to build your own structure manually, follow this pattern:

**Directory Structure:**
```text
.
├── artisan
├── bootstrap/
│   └── application.py
├── config/
└── app/
```

**bootstrap/application.py:**
Initialize the application and register core providers.

```python
from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

app: Application = Application(
    base_path=Path(__file__).parent.parent,
    providers=[FastAPIProvider]
)
```

**artisan:**
Create a CLI entry point script.

```python
#!/usr/bin/env python3
import sys
from bootstrap.application import app

if __name__ == "__main__":
    status = app.handle_command()
    sys.exit(status if isinstance(status, int) else 0)
```

### Running the server
You can now use the `artisan` script to manage your application:

```bash
uv run python artisan serve
```

## Running with Uvicorn

If you prefer to run the application directly via Uvicorn (e.g., for production or custom flags), you can point it to your app instance:

```bash
uv run uvicorn bootstrap.application:app --reload
```
