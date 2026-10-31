---
lesson: 5
title: Adding a database
description: Install the database feature, connect to SQLite and create the projects and tasks tables with migrations.
duration: 8
---

# Adding a database

**Goal:** a SQLite database with a `projects` table and a `tasks` table.

## 1. Install the database feature

`db:install` adds the database config and registers its provider for you:

```bash
uv run python artisan db:install --driver sqlite
```

```
Created config/database.py
Registered DatabaseProvider in bootstrap/application.py
```

Open `bootstrap/application.py` and you'll see a new entry at the end of the list:

```python
    providers=[
        (LogProvider, LoggingConfig),
        (FastapiProvider, FastAPIConfig),
        (ViteProvider, ViteConfig),
        InertiaProvider,
        (DatabaseProvider, DatabaseConfig), # [!code ++]
    ],
```

## 2. Add the packages and settings

Install the ORM and the SQLite driver:

```bash
uv add "fastapi-startkit[database,sqlite]"
```

Tell the app which database to use. Add these lines to `.env`:

```ini
DB_CONNECTION=sqlite
DB_DATABASE=databases/database.sqlite
```

::: tip Restart the server
The server may stop with an import error between `db:install` and `uv add`, because the provider is registered before its packages are installed. Once the packages are in, start it again with `uv run python artisan serve`.
:::

Then create the folder for your migrations:

```bash
mkdir -p databases/migrations
```

## 3. Create the projects table

A migration is a file that changes the database. Make one for projects:

```bash
uv run python artisan db:make:migration create_projects_table --create projects
```

The new file is in `databases/migrations/`. Its name starts with the date and time, so migrations always run in the order you made them. Add a `name` column:

```python
from fastapi_startkit.masoniteorm import Migration


class CreateProjectsTable(Migration):
    async def up(self):
        async with await self.schema.create("projects") as table:
            table.increments("id")
            table.string("name") # [!code ++]
            table.timestamps()

    async def down(self):
        await self.schema.drop("projects")
```

`up()` makes the change. `down()` undoes it. `timestamps()` adds `created_at` and `updated_at` columns, which the ORM fills in for you.

## 4. Create the tasks table

```bash
uv run python artisan db:make:migration create_tasks_table --create tasks
```

Every task belongs to a project, so the table gets a `project_id` column that points at `projects.id`:

```python
from fastapi_startkit.masoniteorm import Migration


class CreateTasksTable(Migration):
    async def up(self):
        async with await self.schema.create("tasks") as table:
            table.increments("id")
            table.integer("project_id").unsigned() # [!code ++]
            table.foreign("project_id").references("id").on("projects").on_delete("cascade") # [!code ++]
            table.string("title") # [!code ++]
            table.text("description").nullable() # [!code ++]
            table.boolean("completed").default(False) # [!code ++]
            table.timestamps()

    async def down(self):
        await self.schema.drop("tasks")
```

`on_delete("cascade")` means that when you delete a project, its tasks go with it.

## 5. Run the migrations

```bash
uv run python artisan db:migrate
```

```
Migrating: 2026_10_29_013734_create_projects_table
Migrated: 2026_10_29_013734_create_projects_table (0.00s)
Migrating: 2026_10_29_013735_create_tasks_table
Migrated: 2026_10_29_013735_create_tasks_table (0.00s)
```

The dates in your file names will be different.

## Check

```bash
uv run python artisan db:migrate:status
```

Both migrations are listed as ran. If you made a mistake in a migration, undo the last batch with `db:migrate:rollback`, fix the file and run `db:migrate` again.
