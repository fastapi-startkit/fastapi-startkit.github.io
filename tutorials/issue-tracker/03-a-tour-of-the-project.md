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
| `config/` | One dataclass per feature, such as `app.py`, `database.py` and `fastapi.py`. |
| `providers/fastapi_provider.py` | Adds your routes to FastAPI. |
| `routes/api.py` | Your routes. |
| `app/http/controllers/` | Your controllers. |
| `app/models/` | Your models, from lesson 5. |
| `databases/` | Migrations, seeders and the SQLite file. |
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
        (DatabaseProvider, DatabaseConfig),
        (FastapiProvider, FastAPIConfig),
        (ViteProvider, ViteConfig),
        InertiaProvider,
    ],
)
```

Each entry in `providers` turns on one feature. When a provider needs settings, it's paired with its config class, like `(DatabaseProvider, DatabaseConfig)`. The application loads `.env` first, so every config class sees your settings.

## 3. Add a config value

A project's issue list will come back a page at a time. Make the page size a setting, so you can change it without touching code.

Create `config/issues.py`:

```python
from dataclasses import dataclass

from fastapi_startkit.environment import env


@dataclass
class IssuesConfig:
    per_page: int = env("ISSUES_PER_PAGE", 20)
```

`env("ISSUES_PER_PAGE", 20)` reads `ISSUES_PER_PAGE` from the environment. If it isn't set, you get `20`. The default's type tells `env()` what to turn the text into, so `"5"` from `.env` becomes the number `5`.

Now add the setting to `.env`, and to `.env.example` so others know it exists:

```ini
ISSUES_PER_PAGE=5
```

You'll use it in lesson 11, when the issue list learns to page.

## Check

Ask Python for the value. Importing `bootstrap.application` loads `.env` first, the same way the server does:

```bash
uv run python -c "from bootstrap.application import app; from config.issues import IssuesConfig; print(IssuesConfig().per_page)"
```

```
5
```

Delete the line from `.env` and run it again. You'll get the default, `20`. Put it back as `ISSUES_PER_PAGE=20` before you move on.

::: info Compare your code
This lesson's code is tagged [`lesson-03`](https://github.com/fastapi-startkit/issue-tracker/tree/lesson-03). See [the changes in this lesson](https://github.com/fastapi-startkit/issue-tracker/compare/lesson-02...lesson-03).
:::
