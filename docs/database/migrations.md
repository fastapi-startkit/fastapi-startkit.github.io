---
outline: deep
title: Migrations
description: Learn how to manage your database schema using version-controlled migration files in Fastapi Startkit.
keywords: fastapi, database, migrations, schema, python, orm
---

# Migrations

Migrations are version-controlled schema definitions. Each migration file contains an `up` method to apply changes and a `down` method to revert them.

::: warning Migrations are not auto-generated
Unlike Django or other ORMs that inspect your models and generate migration files automatically, FastAPI Startkit requires you to write migrations by hand. Your model class defines how Python maps to the database, but it does not drive the schema — the migration does. Think of the migration as the authoritative source of truth for what actually exists in the database.
:::

## Creating a Migration

Use the `artisan` command to scaffold a new migration file with a timestamp prefix already applied:

```bash
uv run python artisan db:make:migration create_users_table
```

This creates a file under `databases/migrations/` ready to fill in:

```text
databases/migrations/
└── 2026_01_01_000000_create_users_table.py
```

## Migration Class

Extend `Migration` and implement `up` and `down` as async methods. Use `self.schema` to build tables:

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

See which migrations have already run and which are still pending:

```bash
uv run python artisan db:migrate:status
```

Output example:

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

Use `self.schema.create()` inside `up` to build a new table:

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
| `table.text("col")` | `TEXT` | |
| `table.uuid("col")` | `UUID` | |
| `table.timestamps()` | `created_at`, `updated_at` | Both managed automatically |

### Column Modifiers

Chain modifiers on any column:

```python
table.string("email").unique()       # UNIQUE constraint
table.string("bio").nullable()       # allow NULL
table.boolean("active").default(True) # column default
table.integer("score").unsigned()    # no negative values
```

## Updating Tables

Use `self.schema.table()` to alter an existing table:

```python
async def up(self):
    async with await self.schema.table("users") as table:
        table.string("bio").nullable()          # add a column
        table.integer("login_count").default(0) # add with default
```

### Dropping Columns

```python
async def up(self):
    async with await self.schema.table("users") as table:
        table.drop_column("bio")
        table.drop_column("login_count", "legacy_flag")  # multiple at once
```

### Modifying a Column

Add `.change()` to modify an existing column's type or constraints:

```python
async with await self.schema.table("users") as table:
    table.string("name", 500).change()   # widen VARCHAR length
    table.text("bio").nullable().change()  # change type
```

### Renaming a Table

```python
async def up(self):
    await self.schema.rename("old_name", "new_name")
```

## Foreign Keys

Declare a foreign key after the column:

```python
table.integer("user_id").unsigned()
table.foreign("user_id").references("id").on("users")
```

Add a cascade rule on delete:

```python
table.integer("post_id").unsigned()
table.foreign("post_id").references("id").on("posts").on_delete("cascade")
```

## Full Example

The blog example creates five tables in a single migration:

```python
# databases/migrations/2026_04_12_000000_create_blog_tables.py
from fastapi_startkit.masoniteorm import Migration

class CreateBlogTables(Migration):
    async def up(self):
        # Users
        async with await self.schema.create("users") as table:
            table.increments("id")
            table.string("name")
            table.string("email").unique()
            table.string("password")
            table.timestamps()

        # Posts
        async with await self.schema.create("posts") as table:
            table.increments("id")
            table.integer("user_id").unsigned()
            table.foreign("user_id").references("id").on("users")
            table.string("title")
            table.text("content")
            table.timestamps()

        # Tags
        async with await self.schema.create("tags") as table:
            table.increments("id")
            table.string("name").unique()
            table.timestamps()

        # Post-Tag pivot (no timestamps)
        async with await self.schema.create("post_tag") as table:
            table.increments("id")
            table.integer("post_id").unsigned()
            table.foreign("post_id").references("id").on("posts").on_delete("cascade")
            table.integer("tag_id").unsigned()
            table.foreign("tag_id").references("id").on("tags").on_delete("cascade")

        # Media
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
