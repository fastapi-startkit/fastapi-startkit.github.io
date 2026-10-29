---
lesson: 7
title: Seeding data
description: Fill the database with sample projects and tasks using seeders.
duration: 5
---

# Seeding data

**Goal:** a database with sample projects and tasks you can rebuild with one command.

## 1. Create a seeder

A seeder is a class that puts rows in the database. Make one for projects:

```bash
mkdir -p databases/seeders
uv run python artisan seed Project
```

This creates `databases/seeders/project_table_seeder.py`. Fill in `run()` with two projects and their tasks:

```python
from fastapi_startkit.masoniteorm.seeders import Seeder

from app.models.project import Project # [!code ++]
from app.models.task import Task # [!code ++]


class ProjectTableSeeder(Seeder):
    async def run(self) -> None:
        pass # [!code --]
        website = await Project.create({"name": "Website redesign"}) # [!code ++]
        await Task.create({"project_id": website.id, "title": "Draft the homepage copy"}) # [!code ++]
        await Task.create({"project_id": website.id, "title": "Pick a color palette", "completed": True}) # [!code ++]

        launch = await Project.create({"name": "Product launch"}) # [!code ++]
        await Task.create({"project_id": launch.id, "title": "Write the announcement post"}) # [!code ++]
```

`create()` inserts a row and returns the model, so `website.id` is the id the database just gave it.

## 2. Add the database seeder

`db:seed` starts from one seeder called `DatabaseSeeder`, which calls the others. Create `databases/seeders/database_seeder.py`:

```python
from fastapi_startkit.masoniteorm.seeders import Seeder

from databases.seeders.project_table_seeder import ProjectTableSeeder


class DatabaseSeeder(Seeder):
    async def run(self) -> None:
        await self.call(ProjectTableSeeder)
```

When you add more seeders later, pass them to the same `call()`.

## 3. Run it

`db:migrate:fresh` drops every table and runs your migrations again, so you start clean. Then `db:seed` fills the tables:

```bash
uv run python artisan db:migrate:fresh
uv run python artisan db:seed
```

```
Database Seeder seeded!
```

Run both commands again whenever you want your sample data back the way it started.

## Check

```bash
curl http://127.0.0.1:8000/api/tasks
```

You get the three tasks, newest first:

```json
[
  {"id": 3, "project_id": 2, "title": "Write the announcement post", "description": null, "completed": false, "created_at": "2026-10-29T08:39:07.496485Z"},
  {"id": 2, "project_id": 1, "title": "Pick a color palette", "description": null, "completed": true, "created_at": "2026-10-29T08:39:07.494499Z"},
  {"id": 1, "project_id": 1, "title": "Draft the homepage copy", "description": null, "completed": false, "created_at": "2026-10-29T08:39:07.493476Z"}
]
```
