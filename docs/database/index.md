---
outline: deep
title: "Database: Getting Started"
description: Supported databases, configuration, raw SQL queries, multiple connections, and transactions in FastAPI Startkit's async ORM.
keywords: database, orm, db:install, sqlite, mysql, postgresql, raw sql, transactions, fastapi, python
---

# Database: Getting Started

## Introduction

Almost every application needs to talk to a database. FastAPI Startkit ships with an async fork of Masonite ORM built on SQLAlchemy's asyncio engine. You can write raw SQL, use the query builder, or define models, and every database call is awaited.

FastAPI Startkit supports three databases, each through an async driver:

| Database | Driver | Install extra | Config class |
|---|---|---|---|
| SQLite | `aiosqlite` | `sqlite` | `SQLiteConfig` |
| MySQL | `aiomysql` | `mysql` | `MySQLConfig` |
| PostgreSQL | `asyncpg` | `postgres` | `PostgresConfig` |

A connection with any other driver raises `DriverNotFound` when it's first used.

## Installation

Setting up a database takes three steps: install the ORM with a driver, run `db:install`, and add your connection details to `.env`.

### Installing the ORM and a Driver

The ORM lives in the `database` extra, and each driver is its own extra. Install `database` together with the driver for your database:

```bash
# SQLite
uv add "fastapi-startkit[database,sqlite]"

# MySQL
uv add "fastapi-startkit[database,mysql]"

# PostgreSQL
uv add "fastapi-startkit[database,postgres]"
```

With pip, use the same extras: `pip install "fastapi-startkit[database,postgres]"`. Combine driver extras if you connect to more than one kind of database.

::: tip MySQL 8
MySQL 8 authenticates with `caching_sha2_password` by default, and the MySQL driver needs the `cryptography` package for that. If connecting fails with `'cryptography' package is required`, install it with `uv add cryptography`.
:::

### Running `db:install`

Next, run the `db:install` command with the driver you installed. `--driver` accepts `sqlite` (the default), `mysql`, or `postgres`:

```bash
uv run python artisan db:install --driver=postgres
```

The command does two things:

- It creates `config/database.py` with one connection for your driver, and makes that connection the default.
- It registers `DatabaseProvider` with that config in `bootstrap/application.py`, adding the imports for you.

Then it prints the remaining steps:

```text
Created config/database.py
Registered DatabaseProvider in bootstrap/application.py

Next steps:
  Add to .env:
    DB_CONNECTION=postgres
    DB_HOST=127.0.0.1
    DB_PORT=5432
    DB_DATABASE=blog
    DB_USERNAME=postgres
    DB_PASSWORD=
  Create the migrations directory: mkdir -p databases/migrations
  Create a migration: uv run python artisan db:make:migration create_users_table
  Run migrations: uv run python artisan db:migrate
```

`DB_DATABASE` defaults to your project's directory name. For SQLite, the command suggests `DB_DATABASE=databases/database.sqlite`.

`db:install` doesn't install packages, edit `.env`, or create directories. Copy the printed keys into `.env` with your real credentials, then create the migrations directory and run your first migration:

```bash
mkdir -p databases/migrations
uv run python artisan db:make:migration create_users_table
uv run python artisan db:migrate
```

::: warning Install the extras first
Once `DatabaseProvider` is registered, every `artisan` command imports the ORM. If you run `db:install` before installing the `database` extra, the command still succeeds and reminds you to install it, but `artisan` fails with `No module named 'sqlalchemy'` until you do.
:::

Running `db:install` again is safe. An existing `config/database.py` is skipped, and the provider isn't registered twice. To replace the config, for example to switch to another driver, pass `--force` and update `DB_CONNECTION` and the other keys in `.env` to match:

```bash
uv run python artisan db:install --driver=mysql --force
```

If `bootstrap/application.py` doesn't pass `Application(...)` a literal `providers=[...]` list, the command can't edit it safely. It still creates the config, prints the imports and the provider entry to add by hand, and exits with status 1.

### Manual Setup

If you'd rather not use `db:install`, register `DatabaseProvider` yourself and give it a database config dataclass. The provider won't accept a plain dictionary, and each connection must be a config object such as `SQLiteConfig` or `MySQLConfig`.

#### Inline Config

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

#### Config Class

In a real project, keep the config in its own file, `config/database.py`, and pass the class instead. This is what `db:install` sets up. The application instantiates the class when the provider registers:

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

Your database configuration lives in `config/database.py`. The file `db:install` writes has a single connection named after your driver:

```python
# config/database.py
from dataclasses import dataclass, field

from fastapi_startkit.environment import env
from fastapi_startkit.masoniteorm.config.config import PostgresConfig
from fastapi_startkit.masoniteorm.config.database import DatabaseConfig as BaseDatabaseConfig


@dataclass
class DatabaseConfig(BaseDatabaseConfig):
    default: str = env("DB_CONNECTION", "postgres")
    connections: dict = field(default_factory=lambda: {"postgres": PostgresConfig()})
```

`PostgresConfig()` with no arguments reads its host, database, and credentials from `.env`, as described in [Connection Options](#connection-options). Add more connections to the dictionary as your application needs them, and choose which one is the default:

```python
# config/database.py
from dataclasses import dataclass, field
from fastapi_startkit.environment import env
from fastapi_startkit.masoniteorm import DatabaseConfig as BaseDatabaseConfig
from fastapi_startkit.masoniteorm import DBConfig, MySQLConfig, PostgresConfig, SQLiteConfig

@dataclass
class DatabaseConfig(BaseDatabaseConfig):
    default: str = env("DB_CONNECTION", "sqlite")

    connections: dict[str, DBConfig] = field(default_factory=lambda: {
        "sqlite": SQLiteConfig(
            database=env("DB_DATABASE", "database.sqlite"),
        ),
        "mysql": MySQLConfig(
            host=env("DB_HOST", "127.0.0.1"),
            port=env("DB_PORT", 3306),
            database=env("DB_DATABASE", "app"),
            username=env("DB_USERNAME", "root"),
            password=env("DB_PASSWORD", ""),
        ),
        "postgres": PostgresConfig(
            host=env("DB_HOST", "127.0.0.1"),
            port=env("DB_PORT", 5432),
            database=env("DB_DATABASE", "app"),
            username=env("DB_USERNAME", "postgres"),
            password=env("DB_PASSWORD", ""),
        ),
    })

    migrations: dict[str, str] = field(default_factory=lambda: {
        "table": "migrations",
        "directory": "databases/migrations",
    })
```

`default` is the name of a key in `connections`, not a driver name. With the file above, `DB_CONNECTION=postgres` selects the PostgreSQL connection. `migrations` is optional, and the values shown are the defaults.

`env()` returns a dataclass field. Use it as a field default or as an argument to a config class such as `SQLiteConfig`. Don't wrap it in `field(default_factory=lambda: env(...))`, and don't put it in a plain dict, because the value is never read there.

Your credentials belong in `.env`, not in code:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=myapp
DB_USERNAME=myuser
DB_PASSWORD=secret
```

### Connection Options

Each config class reads its defaults from environment variables, so a bare `MySQLConfig()` is already configured by your `.env`. Arguments you pass override them.

| Option | Environment variable | `SQLiteConfig` | `MySQLConfig` | `PostgresConfig` |
|---|---|---|---|---|
| `url` | `DB_URL` | empty | empty | empty |
| `database` | `DB_DATABASE` | `database.sqlite` | `inertia` | `inertia` |
| `host` | `DB_HOST` | | `127.0.0.1` | `127.0.0.1` |
| `port` | `DB_PORT` | | `3306` | `5432` |
| `username` | `DB_USERNAME` | | `root` | `postgres` |
| `password` | `DB_PASSWORD` | | empty | empty |
| `echo` | `DB_ECHO` | `False` | `False` | `False` |

`MySQLConfig` and `PostgresConfig` also have `charset`, `collation`, `sslmode`, and `unix_socket` fields, but they aren't passed to the driver, so setting them has no effect.

### SQLite Configuration

A SQLite database is a single file. Point `database` (or `DB_DATABASE`) at it:

```dotenv
DB_CONNECTION=sqlite
DB_DATABASE=/absolute/path/to/database.sqlite
```

A relative path is resolved from the directory you start the application in, so an absolute path is safer. SQLite creates the file the first time you connect.

For a throwaway database that lives only as long as the process, use `:memory:`:

```python
SQLiteConfig(database=":memory:")
```

Every query shares one in-memory database, so tables you create stay available until the process exits. This isn't true when `APP_ENV` is `testing`. Under `testing`, connections aren't pooled, so each query outside a transaction gets a fresh, empty in-memory database. Use a file for your test database.

### Configuration Using URLs

Some hosting providers give you a single connection URL instead of separate host, user, and password values. Pass it as `url`, or set `DB_URL`. When `url` is set, the other connection fields are ignored:

```python
PostgresConfig(url="postgresql+asyncpg://user:secret@db.example.com:5432/app")
```

The URL goes straight to SQLAlchemy, so it has to name the async driver:

| Database | URL format |
|---|---|
| SQLite | `sqlite+aiosqlite:///path/to/database.sqlite` |
| MySQL | `mysql+aiomysql://user:password@host:3306/database` |
| PostgreSQL | `postgresql+asyncpg://user:password@host:5432/database` |

A plain `postgres://` or `mysql://` URL fails with `NoSuchModuleError`. Use the config class that matches the database in the URL, because the class decides which SQL grammar the connection uses.

::: warning DB_URL and multiple connections
Every config class reads `DB_URL` by default. If you set `DB_URL` and define more than one connection, every connection without its own `url` connects to that same database. Give each connection its own variable instead:

```python
"postgres": PostgresConfig(url=env("DATABASE_URL", "")),
"reporting": PostgresConfig(url=env("REPORTING_DATABASE_URL", "")),
```
:::

### Connection Pool Settings

The config class's `engine_options()` method returns extra keyword arguments for SQLAlchemy's `create_async_engine`. `MySQLConfig` and `PostgresConfig` return none, so SQLAlchemy's default pool applies. To tune the pool, subclass the config and override the method:

```python
from fastapi_startkit.masoniteorm import PostgresConfig

class PooledPostgresConfig(PostgresConfig):
    def engine_options(self) -> dict[str, object]:
        return {
            "pool_size": 10,
            "max_overflow": 5,
            "pool_pre_ping": True,
            "pool_recycle": 1800,
        }
```

Use the subclass in `connections` the same way as the original class. `SQLiteConfig.engine_options()` already sets a single shared connection, so start from `super().engine_options()` if you override it there.

When `APP_ENV` is `testing`, connections are never pooled and `engine_options()` isn't called.

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

## Running SQL Queries

Once a connection is configured, you can run raw SQL through the `DB` facade. It has a method for each kind of statement: `select`, `select_one`, `insert`, `update`, `delete`, and `statement`.

```python
from fastapi_startkit.masoniteorm.facades import DB
```

#### Running a Select Query

`select` takes the SQL and a list of bindings, and returns a list of dictionaries, one per row:

```python
users = await DB.select("select * from users where active = ?", [1])

for user in users:
    print(user["name"])
```

Each `?` in the query is replaced with the next binding, in order. Bindings are sent to the database separately from the SQL, which protects you from SQL injection. Always bind values from users instead of formatting them into the query.

Every `?` counts as a placeholder, even one inside a quoted string in your SQL. Bind such values too: `DB.select("select * from posts where title = ?", ["Why?"])`.

#### Selecting a Single Row

`select_one` returns the first row as a dictionary, or `None` when nothing matches. It's also handy for single values such as counts:

```python
user = await DB.select_one("select * from users where email = ?", ["taylor@example.com"])

row = await DB.select_one("select count(*) as total from users")
total = row["total"]
```

#### Running an Insert Statement

`insert` runs the statement and returns the new row's auto-increment id on SQLite and MySQL:

```python
user_id = await DB.insert(
    "insert into users (name, email) values (?, ?)",
    ["Taylor", "taylor@example.com"],
)
```

On PostgreSQL, `insert` returns `None`. To get the id, add a `RETURNING` clause and run the statement with `select_one`:

```python
row = await DB.select_one(
    "insert into users (name, email) values (?, ?) returning id",
    ["Taylor", "taylor@example.com"],
)
user_id = row["id"]
```

#### Running an Update Statement

`update` returns the number of rows the statement changed:

```python
affected = await DB.update("update users set votes = 100 where name = ?", ["Taylor"])
```

#### Running a Delete Statement

`delete` also returns the number of affected rows:

```python
deleted = await DB.delete("delete from users where active = ?", [0])
```

#### Running a General Statement

For statements that don't return anything, such as schema changes, use `statement`. It returns `True` once the statement has run:

```python
await DB.statement("create index users_email_index on users (email)")
```

Outside a transaction, each of these methods runs in its own transaction and commits right away. Inside a [transaction](#database-transactions), they run on the transaction's connection.

### Using Multiple Database Connections

Your application can define as many connections as it needs in `connections`. The facade's query methods, including `DB.table()`, always use the default connection. To run a query on another one, get it by name with `DB.connection()`. Connections have the same `select`, `select_one`, `insert`, `update`, `delete`, and `statement` methods:

```python
reports = await DB.connection("reporting").select("select * from reports where year = ?", [2026])
```

`DB.connection()` without a name, or with `"default"`, returns the default connection. A name that isn't in `connections` raises a `ValueError`.

Models use the default connection unless they name another one in `__connection__`:

```python
from fastapi_startkit.masoniteorm import Model

class Report(Model):
    __connection__ = "reporting"
```

Every query and write on `Report` then goes to the `reporting` connection.

### Logging Queries

To see the SQL your application runs, turn on `echo` for a connection, or set `DB_ECHO=true`:

```python
SQLiteConfig(database="database.sqlite", echo=True)
```

SQLAlchemy then logs every statement, its bindings, and each `BEGIN`, `COMMIT`, and `ROLLBACK` at `INFO` level through the `sqlalchemy.engine.Engine` logger. Leave it off in production, because it logs bound values too.

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

Models use the connection named in their `__connection__` attribute, so `Report` here is a model with `__connection__ = "reporting"`, as shown in [Using Multiple Database Connections](#using-multiple-database-connections).

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
