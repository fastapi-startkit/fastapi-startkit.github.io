---
outline: deep
title: Migrations
description: Manage your database schema with version-controlled migration files in FastAPI Startkit.
keywords: fastapi, database, migrations, schema, python, orm
---

# Migrations

Migrations are like version control for your database. Each one is a small, versioned change to your schema, so your teammates and your production server can build the exact same tables you have locally. Every migration has an `up` method that applies the change and a `down` method that reverts it.

::: warning Migrations are not auto-generated
FastAPI Startkit doesn't inspect your models to generate migrations the way Django does. You write each migration by hand. The model describes how Python reads a table; the migration decides what the table looks like.
:::

## Creating a Migration

To create a migration, run `db:make:migration`. It generates a file with a timestamp prefix:

```bash
uv run python artisan db:make:migration create_users_table
```

You'll find the new file in `databases/migrations/`:

```text
databases/migrations/
└── 2026_01_01_000000_create_users_table.py
```

## Migration Class

A migration class extends `Migration` and implements async `up` and `down` methods. Inside them, you build tables with `self.schema`:

```python
from fastapi_startkit.masoniteorm import Migration

class CreateUsersTable(Migration):
    async def up(self):
        async with await self.schema.create("users") as table:
            table.increments("id")
            table.string("name")
            table.string("email").unique()
            table.string("password")
            table.timestamps()

    async def down(self):
        await self.schema.drop("users")
```

## Running Migrations

When you're ready, run all pending migrations:

```bash
uv run python artisan db:migrate
```

### Checking Status

To see which migrations have run and which are still pending, check the status:

```bash
uv run python artisan db:migrate:status
```

```
+------+------------------------------------------+-------+
| Ran? | Migration                                | Batch |
+------+------------------------------------------+-------+
| Y    | 2026_01_01_000000_create_users_table     | 1     |
| Y    | 2026_01_02_000000_create_posts_table     | 1     |
| N    | 2026_05_10_000000_add_bio_to_users_table | -     |
+------+------------------------------------------+-------+
```

## Creating Tables

To create a new table, call `self.schema.create()` in `up`:

```python
async def up(self):
    async with await self.schema.create("posts") as table:
        table.id()
        table.string("title")
        table.text("body").nullable()
        table.boolean("published").default(False)
        table.integer("user_id").unsigned()
        table.foreign("user_id").references("id").on("users")
        table.timestamps()
```

Then drop it again in `down`:

```python
async def down(self):
    await self.schema.drop("posts")
```

### Column Types

The schema builder offers the column types below. The SQL types listed are for PostgreSQL; other databases use their closest equivalent.

| Method | SQL Type | Notes |
|---|---|---|
| `table.id()` | `BIGSERIAL PRIMARY KEY` | Auto-incrementing big integer |
| `table.increments("col")` | `SERIAL PRIMARY KEY` | Auto-incrementing integer |
| `table.integer("col")` | `INTEGER` | |
| `table.big_integer("col")` | `BIGINT` | |
| `table.string("col")` | `VARCHAR(255)` | |
| `table.text("col")` | `TEXT` | |
| `table.boolean("col")` | `BOOLEAN` | |
| `table.decimal("col")` | `DECIMAL` | Use instead of `float` for cross-database compatibility |
| `table.date("col")` | `DATE` | |
| `table.datetime("col")` | `TIMESTAMPTZ` | |
| `table.timestamp("col")` | `TIMESTAMP` | |
| `table.time("col")` | `TIME` | |
| `table.json("col")` | `JSON` | |
| `table.uuid("col")` | `UUID` | |
| `table.timestamps()` | `created_at`, `updated_at` | Filled in by the model on save |

### Column Modifiers

You can chain modifiers onto a column to add constraints or defaults:

```python
table.string("email").unique()
table.string("bio").nullable()
table.boolean("active").default(True)
table.integer("score").unsigned()
```

## Updating Tables

To change a table that already exists, call `self.schema.table()` instead:

```python
async def up(self):
    async with await self.schema.table("users") as table:
        table.string("bio").nullable()
        table.integer("login_count").default(0)
```

### Dropping Columns

To remove columns, pass one or more column names to `drop_column`:

```python
async def up(self):
    async with await self.schema.table("users") as table:
        table.drop_column("bio")
        table.drop_column("login_count", "legacy_flag")
```

### Modifying a Column

To change an existing column's type or constraints, define the column again and add `.change()`:

```python
async with await self.schema.table("users") as table:
    table.string("name", 500).change()
    table.text("bio").nullable().change()
```

### Renaming a Table

```python
async def up(self):
    await self.schema.rename("old_name", "new_name")
```

## Foreign Keys

To add a foreign key, declare the column first, then the constraint:

```python
table.integer("user_id").unsigned()
table.foreign("user_id").references("id").on("users")
```

If you want related rows removed automatically, add `on_delete` with a cascade rule:

```python
table.integer("post_id").unsigned()
table.foreign("post_id").references("id").on("posts").on_delete("cascade")
```

## Full Example

Here's how it all fits together. This migration creates the five tables used by the blog example:

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

        # Pivot table, no timestamps
        async with await self.schema.create("post_tag") as table:
            table.increments("id")
            table.integer("post_id").unsigned()
            table.foreign("post_id").references("id").on("posts").on_delete("cascade")
            table.integer("tag_id").unsigned()
            table.foreign("tag_id").references("id").on("tags").on_delete("cascade")

        async with await self.schema.create("media") as table:
            table.increments("id")
            table.integer("post_id").unsigned()
            table.foreign("post_id").references("id").on("posts").on_delete("cascade")
            table.string("url")
            table.timestamps()

    async def down(self):
        await self.schema.drop("media")
        await self.schema.drop("post_tag")
        await self.schema.drop("tags")
        await self.schema.drop("posts")
        await self.schema.drop("users")
```
