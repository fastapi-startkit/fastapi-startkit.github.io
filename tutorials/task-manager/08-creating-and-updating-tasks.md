---
lesson: 8
title: Creating and updating tasks
description: Fill in the rest of the resource routes, validate the input and return the right status codes.
duration: 8
---

# Creating and updating tasks

**Goal:** create, show, update and delete tasks through the API, with bad input turned away.

## 1. Describe the input

Request bodies are Pydantic models too. FastAPI checks every request against them before your code runs. Create `app/http/requests/task.py`:

```python
from pydantic import BaseModel, Field


class StoreTaskRequest(BaseModel):
    project_id: int
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None


class UpdateTaskRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    completed: bool | None = None
```

Every field in `UpdateTaskRequest` is optional, so you can send just the fields you want to change.

## 2. Add the controller methods

Open `app/http/controllers/task_controller.py` and add the other four methods:

```python
from fastapi import Response # [!code ++]

from app.http.requests.task import StoreTaskRequest, UpdateTaskRequest # [!code ++]
from app.http.resources.task import TaskResource
from app.models.project import Project # [!code ++]
from app.models.task import Task


class TaskController:
    async def index(self) -> list[TaskResource]:
        tasks = await Task.order_by("id", "desc").get()
        return [TaskResource.model_validate(task) for task in tasks]

    async def store(self, request: StoreTaskRequest, response: Response) -> TaskResource: # [!code ++]
        await Project.find_or_fail(request.project_id) # [!code ++]
        task = await Task.create(request.model_dump()) # [!code ++]
        response.status_code = 201 # [!code ++]
        return TaskResource.model_validate(task) # [!code ++]

    async def show(self, task: int) -> TaskResource: # [!code ++]
        return TaskResource.model_validate(await Task.find_or_fail(task)) # [!code ++]

    async def update(self, task: int, request: UpdateTaskRequest) -> TaskResource: # [!code ++]
        found = await Task.find_or_fail(task) # [!code ++]
        await found.update(request.model_dump(exclude_unset=True)) # [!code ++]
        return TaskResource.model_validate(found) # [!code ++]

    async def destroy(self, task: int): # [!code ++]
        found = await Task.find_or_fail(task) # [!code ++]
        await found.delete() # [!code ++]
        return Response(status_code=204) # [!code ++]
```

A few things are going on here:

- `find_or_fail()` looks up a row by id. If there isn't one, the framework answers with a `404` for you, so you never have to check for `None`.
- `store()` checks that the project exists before it creates the task.
- `model_dump(exclude_unset=True)` keeps only the fields the client sent. Without it, a request that only changes `completed` would also wipe the title.
- The `task` argument is the `{task}` part of the URL.

## 3. Turn on every route

In `routes/api.py`, remove `only=` so `resource()` adds all five routes:

```python
api = Router(prefix="/api")
api.resource("tasks", TaskController, only=["index"]) # [!code --]
api.resource("tasks", TaskController) # [!code ++]
```

## Check

Create a task. You get `201` and the new task back:

```bash
curl -i -X POST http://127.0.0.1:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "title": "Ship it"}'
```

```json
{"id": 4, "project_id": 1, "title": "Ship it", "description": null, "completed": false, "created_at": "2026-10-29T08:39:50.204098Z"}
```

Finish it with a `PUT`:

```bash
curl -X PUT http://127.0.0.1:8000/api/tasks/4 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

Now try some bad requests. An empty title gets a `422` that names the field:

```json
{"errors": {"title": ["String should have at least 1 character"]}}
```

A project that doesn't exist gets a `404`:

```json
{"detail": "Project with primary key 99 not found."}
```

Finally, delete the task. You get `204 No Content`, and a `GET /api/tasks/4` afterwards returns `404`:

```bash
curl -i -X DELETE http://127.0.0.1:8000/api/tasks/4
```
