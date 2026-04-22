---
outline: deep
title: Migrations
---

# Migrations

Migrations are version-controlled schema definitions. Each migration file contains an `up` method to apply changes and a `down` method to revert them.

## Creating a Migration

Place migration files in `databases/migrations/`. Name them with a timestamp prefix so they run in the correct order:

```text
databases/migrations/
└── 2026_01_01_000000_create_users_table.py
```

## Migration Class

Extend `Migration` and implement `up` and `down` as async methods. Use `self.schema` to build tables:

```python
from fastapi_startkit.masoniteorm.migrations import Migration

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

## Column Types

| Method | SQL Type | Notes |
|---|---|---|
| `table.increments("id")` | `SERIAL PRIMARY KEY` | Auto-incrementing integer |
| `table.integer("col")` | `INTEGER` | |
| `table.string("col")` | `VARCHAR(255)` | |
| `table.text("col")` | `TEXT` | |
| `table.boolean("col")` | `BOOLEAN` | |
| `table.timestamps()` | `created_at`, `updated_at` | Both timestamp columns |

## Column Modifiers

```python
table.string("email").unique()       # UNIQUE constraint
table.integer("user_id").unsigned()  # UNSIGNED (no negatives)
table.string("bio").nullable()       # Allow NULL
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
from fastapi_startkit.masoniteorm.migrations import Migration

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

## Running Migrations

Use the `artisan` CLI to run pending migrations:

```bash
python artisan migrate
```

To roll back the last batch:

```bash
python artisan migrate:rollback
```