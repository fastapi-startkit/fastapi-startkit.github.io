---
outline: deep
title: Database
---

# Database

Fastapi Startkit ships with a built-in ORM layer powered by **MasoniteORM**, adapted for async Python. It gives you expressive model definitions, an async query builder, migrations, and seeders — all with a Laravel-inspired feel.

## Installation

Install the `database` extra:

```bash
uv add fastapi-startkit --extra database
# or
pip install "fastapi-startkit[database]"
```

## Setup

Register the `DatabaseProvider` in your application. You can pass the configuration either as a simple dictionary or as a structured Pydantic dataclass.

### 1. Dictionary-based (Quick Setup)
For quick prototypes, you can pass the configuration dictionary directly during registration:

```python
# bootstrap/application.py
from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.masoniteorm import DatabaseProvider

app: Application = Application(
    base_path=str(Path(__file__).parent.parent),
    providers=[
       (DatabaseProvider, {
            "default": "sqlite",
            "connections": {
                "sqlite": {
                    "driver": "sqlite",
                    "database": "database.sqlite"
                }
            }
       }),
       # ... other providers
    ]
)
```

### 2. Dataclass-based (Recommended)
For larger projects, we recommend using a structured `DatabaseConfig` class. This provides better type safety and organization.

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

The fastest way to get the default configuration file is to use the `provider:publish` command:

```bash
python artisan provider:publish --provider=DatabaseProvider
```

This will create a `config/database.py` file in your project. Alternatively, you can create it manually:

```python
# config/database.py
from dataclasses import field
from pydantic.dataclasses import dataclass
from fastapi_startkit.environment import env
from fastapi_startkit.masoniteorm import MySQLConfig, SQLiteConfig

@dataclass
class DatabaseConfig:
    default: str = field(default_factory=lambda: env("DB_CONNECTION", "sqlite"))

    connections: dict = field(default_factory=lambda: {
        "sqlite": DatabaseConnection(
            driver="sqlite",
            database=env("DB_DATABASE", "database.sqlite"),
        ),
        "mysql": DatabaseConnection(
            driver="mysql",
            host=env("DB_HOST", "127.0.0.1"),
            database=env("DB_DATABASE", "laravel"),
            username=env("DB_USERNAME", "root"),
            password=env("DB_PASSWORD", ""),
            port=env("DB_PORT", "3306"),
            options={
                "charset": "utf8mb4"
            }
        ),
    })

    migrations: dict = field(default_factory=lambda: {
        "table": "migrations",
        "path": "databases/migrations"
    })
```

Store credentials in a `.env` file:

```dotenv
DB_HOST=127.0.0.1
DB_DATABASE=myapp
DB_USERNAME=myuser
DB_PASSWORD=secret
DB_PORT=5432
```

## Project Structure

A typical database-enabled project looks like this:

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
    └── seeds/
        ├── database_seeder.py
        └── user_seeder.py
```

## Example Application

A complete working example is available in the [example repository](https://github.com/fastapi-startkit/fastapi-startkit-modules/tree/main/example/database-app).