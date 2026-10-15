---
outline: deep
title: Migrations
description: Learn how to manage your database schema using version-controlled migration files in Fastapi Startkit.
keywords: fastapi, database, migrations, schema, python, orm
---

# Migrations

A migration is a versioned change to your database schema. Each migration has an `up` method that applies the change and a `down` method that reverts it.

::: warning Migrations are not auto-generated
Fastapi Startkit does not inspect your models to generate migrations, as Django does. You write each migration by hand. The model describes how Python reads a table; the migration decides what the table looks like.
:::

## Creating a Migration

Generate a migration file with a timestamp prefix:

```bash
uv run python artisan db:make:migration create_users_table
```

The file is created in `databases/migrations/`:

```text
databases/migrations/
└── 2026_01_01_000000_create_users_table.py
```

## Migration Class

Extend `Migration` and implement async `up` and `down` methods. Build tables with `self.schema`:

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

Run all pending migrations:

```bash
uv run python artisan db:migrate
```

### Checking Status

List which migrations have run and which are pending:

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

Call `self.schema.create()` in `up`:

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

Drop the table in `down`:

```python
async def down(self):
    await self.schema.drop("posts")
```

### Column Types

The SQL types below are for PostgreSQL. Other databases use their closest equivalent.

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

Chain modifiers onto a column:

```python
table.string("email").unique()
table.string("bio").nullable()
table.boolean("active").default(True)
table.integer("score").unsigned()
```

## Updating Tables

Call `self.schema.table()` to change an existing table:

```python
async def up(self):
    async with await self.schema.table("users") as table:
        table.string("bio").nullable()
        table.integer("login_count").default(0)
```

### Dropping Columns

`drop_column` takes one or more column names:

```python
async def up(self):
    async with await self.schema.table("users") as table:
        table.drop_column("bio")
        table.drop_column("login_count", "legacy_flag")
```

### Modifying a Column

Add `.change()` to change an existing column's type or constraints:

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

Declare the column, then the foreign key:

```python
table.integer("user_id").unsigned()
table.foreign("user_id").references("id").on("users")
```

Add `on_delete` for a cascade rule:

```python
table.integer("post_id").unsigned()
table.foreign("post_id").references("id").on("posts").on_delete("cascade")
```

## Full Example

This migration creates the five tables used by the blog example:

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
