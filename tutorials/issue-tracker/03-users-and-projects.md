---
lesson: 3
title: Users and projects
description: Create the users and projects tables, their models and some sample data.
duration: 7
---

# Users and projects

**Goal:** a database with three users and two projects in it.

## 1. Create the migrations

A migration is a Python file that creates or changes a table. `artisan` writes the file for you:

```bash
uv run python artisan db:make:migration create_users_table --create users
uv run python artisan db:make:migration create_projects_table --create projects
```

Each command prints the file it created, such as `databases/migrations/2026_11_06_115913_create_users_table.py`. The date at the front keeps migrations in order, so yours will differ.

Fill in the users migration:

```python
from fastapi_startkit.masoniteorm import Migration


class CreateUsersTable(Migration):
    async def up(self):
        async with await self.schema.create("users") as table:
            table.increments("id")
            table.string("name") # [!code ++]
            table.string("email").unique() # [!code ++]
            table.timestamps()

    async def down(self):
        await self.schema.drop("users")
```

And the projects migration:

```python
from fastapi_startkit.masoniteorm import Migration


class CreateProjectsTable(Migration):
    async def up(self):
        async with await self.schema.create("projects") as table:
            table.increments("id")
            table.string("key", 10).unique() # [!code ++]
            table.string("name") # [!code ++]
            table.text("description").nullable() # [!code ++]
            table.timestamps()

    async def down(self):
        await self.schema.drop("projects")
```

The `key` is the short code in front of every issue key, like `WEB` in `WEB-1`. `unique()` makes the database refuse two projects with the same key.

## 2. Add the models

A model is a class for one table. Its annotated fields are the columns you read and write. Create `app/models/user.py`:

```python
from fastapi_startkit.masoniteorm.models import Model


class User(Model):
    id: int
    name: str
    email: str
```

And `app/models/project.py`:

```python
from fastapi_startkit.masoniteorm.models import Model


class Project(Model):
    id: int
    key: str
    name: str
    description: str
```

You don't name the table. `User` uses `users` and `Project` uses `projects`, the plural of the class name.

## 3. Seed some data

Seeders fill the tables with data to work with. Create one for each model:

```bash
uv run python artisan seed User
uv run python artisan seed Project
```

Fill in `databases/seeders/user_table_seeder.py`:

```python
from fastapi_startkit.masoniteorm.seeders import Seeder

from app.models.user import User # [!code ++]


class UserTableSeeder(Seeder):
    async def run(self) -> None:
        pass # [!code --]
        await User.create({"name": "Ada Lovelace", "email": "ada@example.com"}) # [!code ++]
        await User.create({"name": "Grace Hopper", "email": "grace@example.com"}) # [!code ++]
        await User.create({"name": "Alan Turing", "email": "alan@example.com"}) # [!code ++]
```

And `databases/seeders/project_table_seeder.py`:

```python
from fastapi_startkit.masoniteorm.seeders import Seeder

from app.models.project import Project # [!code ++]


class ProjectTableSeeder(Seeder):
    async def run(self) -> None:
        pass # [!code --]
        await Project.create({"key": "WEB", "name": "Website", "description": "The marketing site"}) # [!code ++]
        await Project.create({"key": "APP", "name": "Mobile app"}) # [!code ++]
```

`db:seed` runs `DatabaseSeeder`, so call both seeders from `databases/seeders/database_seeder.py`:

```python
from fastapi_startkit.masoniteorm.seeders import Seeder

from databases.seeders.project_table_seeder import ProjectTableSeeder # [!code ++]
from databases.seeders.user_table_seeder import UserTableSeeder # [!code ++]


class DatabaseSeeder(Seeder):
    async def run(self):
        pass # [!code --]
        await self.call(UserTableSeeder, ProjectTableSeeder) # [!code ++]
```

## Check

Create the tables and seed them:

```bash
uv run python artisan db:migrate
uv run python artisan db:seed
```

```
Migrating: 2026_11_06_115913_create_users_table
Migrated: 2026_11_06_115913_create_users_table (0.00s)
Migrating: 2026_11_06_115914_create_projects_table
Migrated: 2026_11_06_115914_create_projects_table (0.00s)
Database Seeder seeded!
```

If you have the `sqlite3` command, look inside:

```bash
sqlite3 databases/database.sqlite "select id, key, name from projects"
```

```
1|WEB|Website
2|APP|Mobile app
```

::: tip Start again any time
`uv run python artisan db:migrate:fresh` drops every table and runs all migrations again. Follow it with `db:seed` to get the sample data back.
:::

::: info Compare your code
This lesson's code is tagged [`lesson-03`](https://github.com/fastapi-startkit/issue-tracker/tree/lesson-03). See [the changes in this lesson](https://github.com/fastapi-startkit/issue-tracker/compare/lesson-02...lesson-03).
:::
