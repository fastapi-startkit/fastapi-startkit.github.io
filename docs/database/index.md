---
outline: deep
title: Database Overview
description: An overview of the database layer in FastAPI Startkit, powered by an async fork of Masonite ORM.
keywords: database, orm, transactions, fastapi, python
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

## Database Transactions

Some changes only make sense together. An order without its line items, or money that leaves one account and never reaches the other, leaves your data in a state nobody intended. A transaction groups queries so they succeed or fail as a unit: either every change is saved, or none of them is.

Transactions live on a database connection. You reach the connection through the `DB` facade:

```python
from fastapi_startkit.masoniteorm.facades import DB
```

### Running a Transaction

The simplest way to run a transaction is the `transaction()` context manager. When the block finishes normally, the transaction is committed:

```python
async with DB.connection().transaction():
    order = await Order.create({"customer_id": customer.id, "total": 4500})
    await OrderItem.create({"order_id": order.id, "sku": "BOOK-1", "price": 4500})
```

Every query inside the block runs on the transaction's connection, whether it goes through a model, `DB.table()`, or a raw statement such as `DB.statement()`. You don't pass the transaction around.

#### Rolling Back on Exceptions

If an exception escapes the block, the transaction is rolled back and the exception is raised again, so you handle it as usual:

```python
try:
    async with DB.connection().transaction():
        order = await Order.create({"customer_id": customer.id, "total": 4500})
        await charge_card(customer, order.total)
except PaymentFailed:
    ...
```

When `charge_card` raises `PaymentFailed`, the order is never saved.

#### Committing or Rolling Back Early

Use `as` to get the transaction object when you need to end it yourself. Call `rollback()` or `commit()`, and the block won't touch the transaction again when it exits:

```python
async with DB.connection().transaction() as transaction:
    order = await Order.create({"customer_id": customer.id, "total": 4500})

    if not await inventory_available(order):
        await transaction.rollback()
```

### Manually Using Transactions

When a context manager doesn't fit, for example when the transaction starts and ends in different functions, control it yourself with `begin_transaction()`, `commit()`, and `rollback()`:

```python
await DB.begin_transaction()

try:
    order = await Order.create({"customer_id": customer.id, "total": 4500})
    await OrderItem.create({"order_id": order.id, "sku": "BOOK-1", "price": 4500})
    await DB.commit()
except Exception:
    await DB.rollback()
    raise
```

Calling `commit()` or `rollback()` when no transaction is open raises a `RuntimeError`.

### Nested Transactions

You can open a transaction inside another one. The inner transaction becomes a savepoint, so it can roll back on its own without undoing the outer work:

```python
async with DB.connection().transaction():
    await User.create({"name": "Taylor", "email": "taylor@example.com"})

    try:
        async with DB.connection().transaction():
            await User.create({"name": "Abigail", "email": "abigail@example.com"})
            raise RuntimeError("inner failed")
    except RuntimeError:
        pass
```

Taylor is saved and Abigail is not. Nesting works the same way with `begin_transaction()`: each call while a transaction is open starts a savepoint, and `commit()` or `rollback()` acts on the innermost one.

Committing a nested transaction doesn't save anything yet. Its changes become part of the outer transaction, so rolling back the outer transaction undoes them too.

::: warning SQLite
On SQLite, an outer rollback only undoes a nested transaction if the outer transaction has already written something (an insert, update, or delete). A `SELECT` isn't enough. If the nested transaction is the first write, its changes are saved for real when it commits, even if the outer transaction rolls back later. Write in the outer transaction before you open a nested one, or use MySQL or PostgreSQL where this matters.
:::

### Using Other Connections

`DB.connection()` without a name uses your default connection. Pass a name to start a transaction somewhere else:

```python
async with DB.connection("reporting").transaction():
    await Report.create({"title": "Q3"})
```

The manual methods take the connection name as their argument:

```python
await DB.begin_transaction("reporting")
await Report.create({"title": "Q4"})
await DB.commit("reporting")
```

Models use the connection named in their `__connection__` attribute, so `Report` here is a model with `__connection__ = "reporting"`.

A transaction only covers its own connection. Queries on another connection inside the block are not part of it and are not rolled back with it.

### Transactions and Async Tasks

A transaction belongs to the async task that started it. Concurrent requests each get their own connection and transaction, so they never see each other's uncommitted work.

Tasks you create inside the block with `asyncio.create_task()` inherit the transaction and run their queries on the same connection:

```python
async with DB.connection().transaction():
    await User.create({"name": "Taylor", "email": "taylor@example.com"})
    total = await asyncio.create_task(count_users())
```

Here `count_users()` sees Taylor, even though the transaction hasn't committed yet.

### Running Code After Commit

Some work should only happen once the data is saved for good, such as sending an email or dispatching a job. Register it with `DB.after_commit()`:

```python
async with DB.connection().transaction():
    user = await User.create({"name": "Taylor", "email": "taylor@example.com"})
    await DB.after_commit(lambda: send_welcome_email(user.email))
```

`send_welcome_email` runs after the transaction commits. If the transaction rolls back, it never runs.

The callback takes no arguments and can be a regular function or a coroutine function. Bind arguments with a `lambda` or `functools.partial`:

```python
from functools import partial

await DB.after_commit(partial(send_welcome_email, user.email))
```

Passing something that isn't callable raises a `TypeError`.

How the callback is handled depends on where you register it:

| Registered | What happens |
|---|---|
| Outside a transaction | Runs right away |
| Inside a transaction | Runs after the outermost transaction commits, in registration order |
| Inside a nested transaction that commits | Moves to the outer transaction and waits for it |
| Inside a transaction that rolls back | Discarded |

Callbacks run after the connection has been released, so they can read the committed data and start transactions of their own.

If a callback raises, the exception reaches the code that committed. The data stays committed, and the remaining callbacks are skipped.

Callbacks are tracked per connection. To register one for another connection, pass its name:

```python
async with DB.connection("reporting").transaction():
    await Report.create({"title": "Q3"})
    await DB.after_commit(notify_finance, name="reporting")
```

::: tip
`after_commit` runs in the current process. If the process stops right after the commit, the callback is lost. For work that must not be lost, save it to the database inside the transaction and process it afterwards.
:::

### Transactions in Tests

The `RefreshDatabase` and `DatabaseTransaction` testing mixins wrap each test in a transaction and roll it back when the test ends. See [Database Testing](/docs/testing/database) for how to set them up.

Because the test already holds the outermost transaction, every transaction your code opens during the test is a nested one. That has two effects:

- `after_commit` callbacks registered during the test never run. They wait for the test's transaction, which is rolled back.
- On SQLite, the [nested transaction caveat](#nested-transactions) applies. If code that opens a transaction makes the first write of a test, that code's changes are saved for real and survive the rollback. Start the test with a write, such as creating the records it needs, before you call that code.

## Example Application

The [database example app](https://github.com/fastapi-startkit/fastapi-startkit-framework/tree/main/example/database-app) is a complete working project you can browse or run to see all of these pieces together.
