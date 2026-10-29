---
lesson: 6
title: Models
description: Create Project and Task models, shape the JSON with a resource and read tasks from the database.
duration: 7
---

# Models

**Goal:** `GET /api/tasks` reads from the database instead of a made-up list.

## 1. Create the models

A model is a class for one table. You use it to read and write rows. Make one for each table:

```bash
mkdir -p app/models
uv run python artisan db:make:model Project --directory app/models --pep
uv run python artisan db:make:model Task --directory app/models --pep
```

`--pep` gives the files snake_case names, `project.py` and `task.py`. The model's table name comes from the class name: `Project` uses `projects` and `Task` uses `tasks`.

## 2. List the columns

Open `app/models/project.py` and list its columns as annotated fields:

```python
from fastapi_startkit.masoniteorm.models import Model


class Project(Model):
    id: int
    name: str
```

Do the same in `app/models/task.py`:

```python
from fastapi_startkit.masoniteorm.models import Model


class Task(Model):
    id: int
    project_id: int
    title: str
    description: str
    completed: bool
```

The fields do two jobs. They decide which columns you can fill when you create a row, and they convert values as they come out of the database. SQLite stores `completed` as `0` or `1`, and the `bool` field turns it back into `False` or `True`.

## 3. Shape the response

You decide what the API returns with a Pydantic model, called a resource. Create `app/http/resources/task.py`:

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TaskResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str | None
    completed: bool
    created_at: datetime
```

`from_attributes=True` lets Pydantic read the fields straight from a `Task`.

## 4. Read tasks in the controller

Replace the made-up list in `app/http/controllers/task_controller.py`:

```python
from app.http.resources.task import TaskResource
from app.models.task import Task


class TaskController:
    async def index(self) -> list[TaskResource]:
        tasks = await Task.order_by("id", "desc").get()
        return [TaskResource.model_validate(task) for task in tasks]
```

Every database call is `async`, so remember the `await`. `order_by()` starts a query, and `get()` runs it and gives you back a collection of `Task` models.

## Check

```bash
curl http://127.0.0.1:8000/api/tasks
```

```json
[]
```

An empty list is right. The tables are empty, and you'll fill them in the next lesson.
