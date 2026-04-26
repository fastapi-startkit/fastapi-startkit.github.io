---
outline: deep
title: Getting Started
---

Fastapi Startkit is a modular, Laravel-inspired framework for building robust FastAPI applications with minimal boilerplate. That said, **it doesn't enforce you to use FastAPI at all** — you can build completely CLI-only applications or background task workers and still get access to the full suite of infrastructure components such as logging, database, configuration, and dependency injection.

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

---

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
python main.py serve
```

---

## Way 2: Structured Setup (Recommended)

For larger applications, we recommend a Laravel-inspired structure for better organization and maintainability.

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
python artisan serve
```

---

## Running with Uvicorn

If you prefer to run the application directly via Uvicorn (e.g., for production or custom flags), you can point it to your app instance:

```bash
uv run uvicorn bootstrap.application:app --reload
```
