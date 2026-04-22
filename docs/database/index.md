---
outline: deep
title: Database
---

# Database

FastAPI Startkit ships with a built-in ORM layer powered by **MasoniteORM**, adapted for async Python. It gives you expressive model definitions, an async query builder, migrations, and seeders — all with a Laravel-inspired feel.

## Installation

Install the `database` extra:

```bash
uv add fastapi-startkit --extra database
# or
pip install "fastapi-startkit[database]"
```

## Setup

Register the `DatabaseProvider` in your application:

```python
# bootstrap/application.py
from pathlib import Path
from fastapi_startkit.application import Application
from fastapi_startkit.masoniteorm.providers import DatabaseProvider

app: Application = Application(
    base_path=str(Path(__file__).parent.parent),
    providers=[
        DatabaseProvider,
        # ... other providers
    ]
)
```

## Configuration

Create a `config/database.py` file to define your database connections:

```python
# config/database.py
import os
from dotenv import load_dotenv
from fastapi_startkit.masoniteorm.connections.manager import DBManager

load_dotenv()

DATABASES = {
    "default": "postgres",
    "postgres": {
        "driver": "postgres",
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "database": os.getenv("DB_DATABASE", "local"),
        "user": os.getenv("DB_USERNAME", "local"),
        "password": os.getenv("DB_PASSWORD", "secret"),
        "port": os.getenv("DB_PORT", "5432"),
        "prefix": "",
        "options": {
            "min_size": 1,
            "max_size": 10,
        },
    },
}

DB = DBManager(connection_details=DATABASES)
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