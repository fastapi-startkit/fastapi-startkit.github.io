---
outline: deep
title: Database Overview
description: An overview of the database layer in FastAPI Startkit, powered by an async fork of Masonite ORM.
keywords: database, orm, fastapi, python
---

# Database

Almost every application needs to talk to a database. FastAPI Startkit ships with an async fork of Masonite ORM, so you get models, an async query builder, migrations, and seeders out of the box. You describe your tables as Python classes, query them with `await`, and keep your schema under version control alongside the rest of your code.

## Installation

The ORM lives in the optional `database` extra, so install it first:

```bash
uv add fastapi-startkit --extra database
# or
pip install "fastapi-startkit[database]"
```

## Setup

Next, register `DatabaseProvider` in your application and give it a database config dataclass. The provider won't accept a plain dictionary, and each connection must be a config object such as `SQLiteConfig` or `MySQLConfig`.

### Inline Config

When you're putting together a quick prototype, you can build the config inline:

```python
# bootstrap/application.py
from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.masoniteorm import DatabaseConfig, DatabaseProvider, SQLiteConfig

app: Application = Application(
    base_path=str(Path(__file__).parent.parent),
    providers=[
        (DatabaseProvider, DatabaseConfig(
            default="sqlite",
            connections={"sqlite": SQLiteConfig(database="database.sqlite")},
        )),
        # ... other providers
    ]
)
```

### Config Class (Recommended)

In a real project, you'll want the config in its own file, `config/database.py`, and pass the class instead. The application instantiates it when the provider registers:

```python
# bootstrap/application.py
from config.database import DatabaseConfig
from fastapi_startkit import Application
from fastapi_startkit.masoniteorm import DatabaseProvider

app: Application = Application(
    base_path=...,
    providers=[
        (DatabaseProvider, DatabaseConfig),
    ]
)
```

## Configuration

The quickest way to get a config file is to publish the default one with `provider:publish`:

```bash
uv run python artisan provider:publish --provider=database
```

This creates `config/database.py`. If you prefer, you can write it yourself:

```python
# config/database.py
from dataclasses import dataclass, field
from fastapi_startkit.environment import env
from fastapi_startkit.masoniteorm import DatabaseConfig as BaseDatabaseConfig
from fastapi_startkit.masoniteorm import DBConfig, MySQLConfig, SQLiteConfig

@dataclass
class DatabaseConfig(BaseDatabaseConfig):
    default: str = env("DB_CONNECTION", "sqlite")

    connections: dict[str, DBConfig] = field(default_factory=lambda: {
        "sqlite": SQLiteConfig(
            database=env("DB_DATABASE", "database.sqlite"),
        ),
        "mysql": MySQLConfig(
            host=env("DB_HOST", "127.0.0.1"),
            database=env("DB_DATABASE", "app"),
            username=env("DB_USERNAME", "root"),
            password=env("DB_PASSWORD", ""),
            port=env("DB_PORT", 3306),
        ),
    })

    migrations: dict[str, str] = field(default_factory=lambda: {
        "table": "migrations",
        "directory": "databases/migrations",
    })
```

`env()` returns a dataclass field. Use it as a field default or as an argument to a config class such as `SQLiteConfig`. Don't wrap it in `field(default_factory=lambda: env(...))`, and don't put it in a plain dict, because the value is never read there.

Your credentials belong in `.env`, not in code:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=myapp
DB_USERNAME=myuser
DB_PASSWORD=secret
DB_PORT=3306
```

## Project Structure

Once everything is in place, a typical database-enabled project looks like this:

```text
.
├── bootstrap/
│   └── application.py
├── config/
│   └── database.py
├── app/
│   └── models/
│       ├── __init__.py
│       └── user.py
└── databases/
    ├── migrations/
    │   └── 2026_01_01_000000_create_users_table.py
    └── seeders/
        ├── database_seeder.py
        └── user_seeder.py
```

## Example Application

The [database example app](https://github.com/fastapi-startkit/fastapi-startkit-framework/tree/main/example/database-app) is a complete working project you can browse or run to see all of these pieces together.
