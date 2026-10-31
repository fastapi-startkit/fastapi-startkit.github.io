---
lesson: 2
title: Setting up the project
description: Create a new FastAPI Startkit app, install the AI package and register its provider.
duration: 5
---

# Setting up the project

**Goal:** a running app with the AI package installed and ready for your first agent.

## 1. Create the project

Make a new project with the installer. Passing `-n` skips the questions, and `--database=none` leaves out the database because Job Assistant doesn't need one.

```bash
uvx fastapi-startkit@latest init job-assistant --database=none -n
cd job-assistant
```

::: tip No uv yet?
On macOS or Linux, the install script sets up uv for you and runs the same installer:

```bash
curl -fsSL https://fastapi-startkit.github.io/install.sh | bash -s -- job-assistant --database=none -n
```
:::

## 2. Add the AI package

The `ai` extra brings in the agent classes. `langchain-google-genai` is the package that talks to Gemini.

```bash
uv add "fastapi-startkit[fastapi,ai]" langchain-google-genai
```

## 3. Register the AI provider

Providers are how the framework loads features. Open `bootstrap/application.py` and add `AIProvider` to the list:

```python
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.ai import AIProvider # [!code ++]
from fastapi_startkit.logging import LogProvider
from config.app import AppConfig
from config.logging import LoggingConfig
from config.fastapi import FastAPIConfig
from providers.fastapi_provider import FastapiProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    config=AppConfig,
    providers=[
        (LogProvider, LoggingConfig),
        (FastapiProvider, FastAPIConfig),
        AIProvider, # [!code ++]
    ],
)
```

## 4. Add your API key

Open `.env` and add these two lines. Paste your key after the `=` sign.

```ini
AI_PROVIDER=google
GEMINI_API_KEY=
```

You can leave the key empty for now. Every test in this course runs without it, and lesson 3 shows you what happens when it's missing.

## Check

Start the server:

```bash
uv run python artisan serve
```

Then, in a second terminal:

```bash
curl http://127.0.0.1:8000/health
```

```json
{"status": "ok"}
```

If you see that, the app boots with the AI provider loaded. Stop the server with <kbd>Ctrl</kbd>+<kbd>C</kbd>.
