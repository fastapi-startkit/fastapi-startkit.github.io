---
outline: deep
title: Migrations
description: Manage your database schema with version-controlled migration files in FastAPI Startkit.
keywords: fastapi, database, migrations, schema, python, orm
---

# Migrations

## Introduction

Migrations are version control for your database. Each migration is a file that describes one change to your schema, so your teammates and your production server can build the same tables you have locally. Every migration has an `up` method that applies the change and a `down` method that reverts it.

You write each migration by hand. The framework doesn't generate migrations from your models.

- [Generating Migrations](#generating-migrations)
- [Migration Structure](#migration-structure)
- [Running Migrations](#running-migrations)
- [Creating Tables](#creating-tables)
- [Updating Tables](#updating-tables)
- [Foreign Keys](#foreign-keys)

## Generating Migrations

To create a migration, run `db:make:migration` from the project root with a name that describes the change:

```bash
uv run python artisan db:make:migration create_users_table
```

The file is written to `databases/migrations/` under the current directory, which is created if it doesn't exist, with a timestamp prefix that decides the order migrations run in:

```text
databases/migrations/
└── 2026_01_01_000000_create_users_table.py
```

The generator guesses the table name from the migration name and fills in a `create` migration. To choose the table yourself, pass `--create` for a new table or `--table` to alter an existing one:

```bash
uv run python artisan db:make:migration add_bio_to_users_table --table=users
```

To create a model and its migration together, see [Generating a Model](./models#generating-a-model).

## Migration Structure

A migration class extends `Migration` and implements async `up` and `down` methods. Inside them, you change tables with `self.schema`:

```python
# databases/migrations/2026_01_01_000000_create_users_table.py
from fastapi_startkit.masoniteorm import Migration


class CreateUsersTable(Migration):
    async def up(self):
        async with await self.schema.create("users") as table:
            table.increments("id")
            table.string("name")
            table.string("email").unique()
            table.string("password")
            table.string("role").default("member")
            table.boolean("is_active").default(True)
            table.timestamps()

    async def down(self):
        await self.schema.drop("users")
```

The table is created when the `async with` block exits, so declare every column inside it.

## Running Migrations

To run all pending migrations, use `db:migrate`:

```bash
uv run python artisan db:migrate
```

Each run records its migrations as one batch in the `migrations` table. To run a single file, pass its name without `.py` to `--migration`. Use `--connection` to migrate a connection other than the default, and `--directory` to read migrations from a directory other than `databases/migrations`:

```bash
uv run python artisan db:migrate --migration=2026_01_01_000000_create_users_table
```

When your `.env` files set `APP_ENV=production`, `db:migrate` asks for confirmation first. Pass `--force` to skip the prompt.

### Checking Migration Status

To see which migrations have run, use `db:migrate:status`:

```bash
uv run python artisan db:migrate:status
```

```text
+------+------------------------------------------+-------+
| Ran? | Migration                                | Batch |
+------+------------------------------------------+-------+
| Y    | 2026_01_01_000000_create_users_table     | 1     |
| Y    | 2026_01_02_000000_create_posts_table     | 1     |
| N    | 2026_05_10_000000_add_bio_to_users_table | -     |
+------+------------------------------------------+-------+
```

### Rolling Back Migrations

To undo the last batch, run `db:migrate:rollback`. It calls `down` on every migration in that batch:

```bash
uv run python artisan db:migrate:rollback
```

Pass `--migration` to roll back one migration instead.

### Rebuilding the Database

`db:migrate:refresh` rolls back every migration and runs them all again. `db:migrate:fresh` drops every table, without calling `down`, and then runs all migrations:

```bash
uv run python artisan db:migrate:refresh

uv run python artisan db:migrate:fresh --seed=null
```

To run your [seeders](./seeds) afterwards, pass `--seed` with a value to either command. `--seed=null` runs `DatabaseSeeder`, and `--seed=Post` runs `PostTableSeeder` from `databases/seeders/post_table_seeder.py`, the file the `seed Post` command generates. `--seed` without a value is an error.

::: danger
`db:migrate:fresh` drops every table in the database, including tables your migrations didn't create.
:::

## Creating Tables

To create a table, call `self.schema.create()` in `up` and drop it in `down`:

```python
async def up(self):
    async with await self.schema.create("categories") as table:
        table.id()
        table.string("name")
        table.text("description").nullable()
        table.boolean("is_visible").default(True)
        table.timestamps()

async def down(self):
    await self.schema.drop("categories")
```

To check for a table or column first, use `has_table` and `has_column`. `drop_table_if_exists` drops a table only if it's there:

```python
if not await self.schema.has_column("users", "bio"):
    async with await self.schema.table("users") as table:
        table.text("bio").nullable()

await self.schema.drop_table_if_exists("legacy_users")
```

### Column Types

The schema builder offers the column types below. The SQL types listed are for PostgreSQL; MySQL and SQLite use their closest equivalent.

| Method | PostgreSQL type | Notes |
|---|---|---|
| `table.id()` | `BIGSERIAL UNIQUE NOT NULL` | Primary key named `id`, with a `PRIMARY KEY` constraint |
| `table.increments("id")` | `SERIAL UNIQUE NOT NULL` | Primary key, with a `PRIMARY KEY` constraint |
| `table.integer("votes")` | `INTEGER` | |
| `table.big_integer("views")` | `BIGINT` | |
| `table.string("name", 100)` | `VARCHAR(100)` | Length defaults to 255 |
| `table.char("code", 2)` | `CHAR(2)` | |
| `table.text("body")` | `TEXT` | |
| `table.boolean("published")` | `BOOLEAN` | |
| `table.decimal("price", 8, 2)` | `DECIMAL(8, 2)` | Defaults to `(17, 6)` |
| `table.float("ratio")` | `FLOAT(19, 4)` | PostgreSQL rejects this type, so use `table.double()` there |
| `table.double("ratio")` | `DOUBLE PRECISION` | |
| `table.date("due_on")` | `DATE` | |
| `table.datetime("sent_at")` | `TIMESTAMPTZ` | |
| `table.timestamp("seen_at")` | `TIMESTAMP` | |
| `table.time("starts_at")` | `TIME` | |
| `table.json("settings")` | `JSON` | `table.jsonb()` for `JSONB` |
| `table.uuid("token")` | `UUID` | |
| `table.timestamps()` | `TIMESTAMPTZ` | Nullable `created_at` and `updated_at`, defaulting to the current time |

### Column Modifiers

Chain modifiers onto a column to add constraints or defaults:

```python
table.string("email").unique()
table.string("bio").nullable()
table.boolean("active").default(True)
table.integer("score").unsigned()
table.string("slug").index()
```

To use a column other than `id` as the primary key, add `.primary()` and leave out `table.id()`. Column names are quoted, so reserved words such as `key` and `order` work as column names:

```python
async with await self.schema.create("settings") as table:
    table.string("key").primary()
    table.string("order")
```

## Updating Tables

To change a table that already exists, call `self.schema.table()`. New columns are added to the table:

```python
async def up(self):
    async with await self.schema.table("users") as table:
        table.string("bio").nullable()
        table.integer("login_count").default(0)
```

### Modifying Columns

To change an existing column's type or constraints, declare the column again and add `.change()`:

```python
async with await self.schema.table("users") as table:
    table.string("name", 500).change()
    table.text("bio").nullable().change()
```

### Dropping Columns

To remove columns, pass one or more names to `drop_column`:

```python
async with await self.schema.table("users") as table:
    table.drop_column("login_count", "legacy_flag")
```

### Renaming Tables

To rename a table, call `rename` with the old and new names:

```python
await self.schema.rename("drafts", "notes")
```

## Foreign Keys

To add a foreign key, declare the column, then the constraint:

```python
table.integer("user_id").unsigned()
table.foreign("user_id").references("id").on("users")
```

`foreign_id` creates an unsigned big integer column and starts the constraint in one call. Add `on_delete` to remove related rows along with their parent:

```python
async with await self.schema.create("comments") as table:
    table.id()
    table.foreign_id("post_id").references("id").on("posts").on_delete("cascade")
    table.text("body")
    table.timestamps()
```

`on_update` takes the same rules as `on_delete`, such as `"cascade"` or `"set null"`.

### A Complete Example

This migration creates the tables used by a small blog, including a `post_tag` pivot table without timestamps:

```python
# databases/migrations/2026_04_12_000000_create_blog_tables.py
from fastapi_startkit.masoniteorm import Migration


class CreateBlogTables(Migration):
    async def up(self):
        async with await self.schema.create("users") as table:
            table.increments("id")
            table.string("name")
            table.string("email").unique()
            table.string("password")
            table.string("role").default("member")
            table.boolean("is_active").default(True)
            table.timestamps()

        async with await self.schema.create("posts") as table:
            table.increments("id")
            table.integer("user_id").unsigned()
            table.foreign("user_id").references("id").on("users")
            table.string("title")
            table.text("content")
            table.timestamps()

        async with await self.schema.create("tags") as table:
            table.increments("id")
            table.string("name").unique()
            table.timestamps()

        async with await self.schema.create("post_tag") as table:
            table.increments("id")
            table.integer("post_id").unsigned()
            table.foreign("post_id").references("id").on("posts").on_delete("cascade")
            table.integer("tag_id").unsigned()
            table.foreign("tag_id").references("id").on("tags").on_delete("cascade")

    async def down(self):
        await self.schema.drop("post_tag")
        await self.schema.drop("tags")
        await self.schema.drop("posts")
        await self.schema.drop("users")
```

See [Models](./models) to query these tables, and [Seeding](./seeds) to fill them with data.
