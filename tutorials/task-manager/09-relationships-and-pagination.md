---
lesson: 9
title: Relationships and pagination
description: Connect projects to their tasks, load them together and page through long lists.
duration: 8
---

# Relationships and pagination

**Goal:** a `/api/projects` endpoint that includes each project's tasks, and a task list that comes a page at a time.

## 1. Define the relationships

A project has many tasks, and a task belongs to one project. Tell the models about it. In `app/models/project.py`:

```python
from typing import TYPE_CHECKING # [!code ++]

from fastapi_startkit.masoniteorm.models import Model
from fastapi_startkit.masoniteorm.relationships import HasMany # [!code ++]

if TYPE_CHECKING: # [!code ++]
    from app.models.task import Task # [!code ++]


class Project(Model):
    id: int
    name: str

    tasks = HasMany["Task"](local_key="id", foreign_key="project_id") # [!code ++]
```

And in `app/models/task.py`:

```python
from typing import TYPE_CHECKING # [!code ++]

from fastapi_startkit.masoniteorm.models import Model
from fastapi_startkit.masoniteorm.relationships import BelongsTo # [!code ++]

if TYPE_CHECKING: # [!code ++]
    from app.models.project import Project # [!code ++]


class Task(Model):
    id: int
    project_id: int
    title: str
    description: str
    completed: bool

    project = BelongsTo["Project"](local_key="project_id", foreign_key="id") # [!code ++]
```

`local_key` is the column on this model and `foreign_key` is the column on the other one. The `TYPE_CHECKING` imports let your editor know what `"Task"` and `"Project"` are, without the two files importing each other when the app runs.

## 2. Load related records up front

Relationships aren't loaded until you ask for them. You ask with `with_()`, which loads the tasks for every project in one extra query instead of one query per project:

```python
projects = await Project.with_("tasks").get()
```

If you already have a model, `load()` does the same thing for it:

```python
project = await Project.find_or_fail(1)
await project.load("tasks")
```

Reading `project.tasks` without loading it first raises a `LazyLoadingViolation`. This stops a loop over 100 projects from quietly running 100 queries.

## 3. Add a projects endpoint

Add a resource for projects to `app/http/resources/task.py`:

```python
class ProjectResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    tasks: list[TaskResource] = []
```

Then create `app/http/controllers/project_controller.py`:

```python
from app.http.resources.task import ProjectResource
from app.models.project import Project


class ProjectController:
    async def index(self) -> list[ProjectResource]:
        projects = await Project.with_("tasks").order_by("name").get()
        return [ProjectResource.model_validate(project) for project in projects]

    async def show(self, project: int) -> ProjectResource:
        found = await Project.find_or_fail(project)
        await found.load("tasks")
        return ProjectResource.model_validate(found)
```

Register it in `routes/api.py`. Projects are read-only for now, so keep just two routes:

```python
from app.http.controllers.home_controller import HomeController
from app.http.controllers.project_controller import ProjectController # [!code ++]
from app.http.controllers.task_controller import TaskController
from fastapi_startkit.fastapi import Router

controller = HomeController()
router = Router()
router.get("/", controller.index, response_model=None)
router.get("/health", controller.health)

api = Router(prefix="/api")
api.resource("projects", ProjectController, only=["index", "show"]) # [!code ++]
api.resource("tasks", TaskController)
```

## 4. Page through tasks

A task list grows forever, so return it a page at a time. This is where the `TASKS_PER_PAGE` setting from lesson 3 comes in. Change `index()` in `TaskController`:

```python
from config.tasks import TasksConfig # [!code ++]

class TaskController:
    async def index(self) -> list[TaskResource]: # [!code --]
        tasks = await Task.order_by("id", "desc").get() # [!code --]
        return [TaskResource.model_validate(task) for task in tasks] # [!code --]
    async def index(self, page: int = 1): # [!code ++]
        tasks = await Task.order_by("id", "desc").paginate(per_page=TasksConfig().per_page, page=page) # [!code ++]
        return { # [!code ++]
            "data": [TaskResource.model_validate(task) for task in tasks.result], # [!code ++]
            "total": tasks.total, # [!code ++]
            "current_page": tasks.current_page, # [!code ++]
            "last_page": tasks.last_page, # [!code ++]
        } # [!code ++]
```

`page` isn't part of the path, so FastAPI reads it from the query string: `/api/tasks?page=2`. `paginate()` counts the rows and fetches one page. `result` holds the models for that page.

## Check

Ask for the projects:

```bash
curl http://127.0.0.1:8000/api/projects/1
```

```json
{
  "id": 1,
  "name": "Website redesign",
  "tasks": [
    {"id": 1, "project_id": 1, "title": "Draft the homepage copy", "description": null, "completed": false, "created_at": "2026-10-29T08:39:07.493476Z"},
    {"id": 2, "project_id": 1, "title": "Pick a color palette", "description": null, "completed": true, "created_at": "2026-10-29T08:39:07.494499Z"}
  ]
}
```

Now set `TASKS_PER_PAGE=2` in `.env` and ask for the second page:

```bash
curl "http://127.0.0.1:8000/api/tasks?page=2"
```

```json
{
  "data": [
    {"id": 1, "project_id": 1, "title": "Draft the homepage copy", "description": null, "completed": false, "created_at": "2026-10-29T08:39:07.493476Z"}
  ],
  "total": 3,
  "current_page": 2,
  "last_page": 2
}
```

Set it back to `5` when you're done.
