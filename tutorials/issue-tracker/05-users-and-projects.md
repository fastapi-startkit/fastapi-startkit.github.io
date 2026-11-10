---
lesson: 5
title: Users and projects
description: Create the users and projects tables with migrations, add their models and fill them with seeders.
duration: 10
---

# Users and projects

**Goal:** a database with three users and two projects in it, which you can rebuild with two commands.

## 1. Create the migrations

A migration is a Python file that creates or changes a table. `artisan` writes the file for you:

```bash
uv run python artisan db:make:migration create_users_table --create users
uv run python artisan db:make:migration create_projects_table --create projects
```

Each command prints the file it created, such as `databases/migrations/2026_11_06_115913_create_users_table.py`. The date and time at the front keep migrations in order, so yours will differ.

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

`up()` makes the change and `down()` undoes it. `timestamps()` adds `created_at` and `updated_at` columns, which the ORM fills in for you.

The `key` is the short code in front of every issue key, like `WEB` in `WEB-1`. `unique()` makes the database refuse two projects with the same key.

## 2. Add the models

A model is a class for one table. You use it to read and write rows. Make one for each table:

```bash
uv run python artisan db:make:model User --directory app/models --pep
uv run python artisan db:make:model Project --directory app/models --pep
```

`--pep` gives the files snake_case names, `user.py` and `project.py`. Open `app/models/user.py` and list its columns as annotated fields:

```python
from fastapi_startkit.masoniteorm.models import Model


class User(Model):
    pass # [!code --]
    id: int # [!code ++]
    name: str # [!code ++]
    email: str # [!code ++]
```

Do the same in `app/models/project.py`:

```python
from fastapi_startkit.masoniteorm.models import Model


class Project(Model):
    pass # [!code --]
    id: int # [!code ++]
    key: str # [!code ++]
    name: str # [!code ++]
    description: str # [!code ++]
```

The fields do two jobs. They decide which columns you can fill when you create a row, and they convert values as they come out of the database.

You don't name the table. `User` uses `users` and `Project` uses `projects`, the plural of the class name.

## 3. Seed some data

A seeder is a class that puts rows in the database. Create one for each model:

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

`create()` inserts a row and returns the model, with the `id` the database just gave it.

`db:seed` starts from one seeder called `DatabaseSeeder`, which calls the others. Call both from `databases/seeders/database_seeder.py`:

```python
from fastapi_startkit.masoniteorm.seeders import Seeder

from databases.seeders.project_table_seeder import ProjectTableSeeder # [!code ++]
from databases.seeders.user_table_seeder import UserTableSeeder # [!code ++]


class DatabaseSeeder(Seeder):
    async def run(self):
        pass # [!code --]
        await self.call(UserTableSeeder, ProjectTableSeeder) # [!code ++]
```

When you add more seeders later, pass them to the same `call()`.

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

Ask which migrations have run:

```bash
uv run python artisan db:migrate:status
```

Both are listed with `Y` in the **Ran?** column. If you made a mistake in a migration, undo the last batch with `db:migrate:rollback`, fix the file and run `db:migrate` again.

If you have the `sqlite3` command, look inside:

```bash
sqlite3 databases/database.sqlite "select id, key, name from projects"
```

```
1|WEB|Website
2|APP|Mobile app
```

::: tip Start again any time
`uv run python artisan db:migrate:fresh` drops every table and runs all migrations again. Follow it with `db:seed` to get the sample data back the way it started.
:::

::: info Compare your code
This lesson's code is tagged [`lesson-05`](https://github.com/fastapi-startkit/issue-tracker/tree/lesson-05). See [the changes in this lesson](https://github.com/fastapi-startkit/issue-tracker/compare/lesson-04...lesson-05).
:::
