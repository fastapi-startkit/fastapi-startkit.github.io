---
lesson: 3
title: A tour of the project
description: Find your way around the new project and add your first configuration value.
duration: 6
---

# A tour of the project

**Goal:** know where things live and read a setting from `.env`.

## 1. The folders

Open the project in your editor. These are the parts you'll touch in this course:

| Path | What it holds |
|---|---|
| `artisan` | The command line. Run it with `uv run python artisan`. |
| `bootstrap/application.py` | Creates the `Application` and lists its providers. |
| `config/` | One dataclass per feature, such as `app.py`, `fastapi.py` and `logging.py`. |
| `providers/fastapi_provider.py` | Adds your routes to FastAPI. |
| `routes/api.py` | Your routes. |
| `app/http/controllers/` | Your controllers. |
| `resources/js/Pages/` | Your Vue pages. |
| `tests/` | Your tests. |
| `.env` | Settings for your machine. It's not committed to git. |

## 2. The application

Open `bootstrap/application.py`:

```python
app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    config=AppConfig,
    providers=[
        (LogProvider, LoggingConfig),
        (FastapiProvider, FastAPIConfig),
        (ViteProvider, ViteConfig),
        InertiaProvider,
    ],
)
```

Each entry in `providers` turns on one feature. When a provider needs settings, it's paired with its config class, like `(LogProvider, LoggingConfig)`. The application loads `.env` first, so every config class sees your settings.

## 3. Add a config value

Task Manager will show tasks a page at a time. Make the page size a setting, so you can change it without touching code.

Create `config/tasks.py`:

```python
from dataclasses import dataclass

from fastapi_startkit.environment import env


@dataclass
class TasksConfig:
    per_page: int = env("TASKS_PER_PAGE", 10)
```

`env("TASKS_PER_PAGE", 10)` reads `TASKS_PER_PAGE` from the environment. If it isn't set, you get `10`. The default's type tells `env()` what to turn the text into, so `"5"` from `.env` becomes the number `5`.

Now add the setting to `.env`:

```ini
TASKS_PER_PAGE=5
```

## Check

Ask Python for the value. Importing `bootstrap.application` loads `.env` first, the same way the server does:

```bash
uv run python -c "from bootstrap.application import app; from config.tasks import TasksConfig; print(TasksConfig().per_page)"
```

```
5
```

Delete the line from `.env` and run it again. You'll get the default, `10`. Put the line back before you move on.
