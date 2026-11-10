---
lesson: 6
title: The projects API
description: List and create projects through the API, with validation rules that check the database.
duration: 8
---

# The projects API

**Goal:** list, show and create projects, and turn away a bad or duplicate project key.

## 1. Shape the output

A resource is a Pydantic model that decides what the API sends back. `from_attributes=True` lets it read straight from a model. Create `app/http/resources/project.py`:

```python
from pydantic import BaseModel, ConfigDict


class ProjectResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    name: str
    description: str | None
```

And `app/http/resources/user.py`:

```python
from pydantic import BaseModel, ConfigDict


class UserResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
```

## 2. Validate the input

A `FormRequest` describes a request body and the rules each field must pass. Rules are chained on `Field()`. Create `app/http/requests/project.py`:

```python
from typing import Annotated

from fastapi_startkit.validation import Field, FormRequest


class StoreProjectRequest(FormRequest):
    key: Annotated[str, Field().required().regex(r"^[A-Z]{2,10}$").unique("projects")]
    name: Annotated[str, Field().required().max(255)]
    description: str | None = None
```

The `key` must be two to ten capital letters, and `unique("projects")` checks the `projects` table so two projects can't share a key. You get a clear error long before the database's own unique index would complain.

## 3. Read and write real projects

Replace the made-up list in `app/http/controllers/project_controller.py` with real queries, and add `store()` and `show()`:

```python
from fastapi import Response # [!code ++]
from fastapi_startkit.validation import Validated # [!code ++]

from app.http.requests.project import StoreProjectRequest # [!code ++]
from app.http.resources.project import ProjectResource # [!code ++]
from app.models.project import Project # [!code ++]


class ProjectController:
    async def index(self): # [!code --]
        return [ # [!code --]
            {"id": 1, "key": "WEB", "name": "Website"}, # [!code --]
            {"id": 2, "key": "APP", "name": "Mobile app"}, # [!code --]
        ] # [!code --]
    async def index(self) -> list[ProjectResource]: # [!code ++]
        projects = await Project.order_by("key").get() # [!code ++]
        return [ProjectResource.model_validate(project) for project in projects] # [!code ++]

    async def store(self, request: Validated[StoreProjectRequest], response: Response) -> ProjectResource: # [!code ++]
        project = await Project.create(request.model_dump()) # [!code ++]
        response.status_code = 201 # [!code ++]
        return ProjectResource.model_validate(project) # [!code ++]

    async def show(self, project: int) -> ProjectResource: # [!code ++]
        return ProjectResource.model_validate(await Project.find_or_fail(project)) # [!code ++]
```

A few things are going on here:

- Every database call is `async`, so remember the `await`. `order_by()` starts a query, and `get()` runs it and gives you back a collection of `Project` models.
- `Validated[StoreProjectRequest]` runs every rule before `store()` is called. If any rule fails, the client gets a `422` and your code never runs.
- `response.status_code = 201` tells the client something new was created.
- The `project` argument of `show()` is the `{project}` part of the URL. `find_or_fail()` looks up a row by id and answers with a `404` when there isn't one, so you never have to check for `None`.

Issues need a reporter, so add a way to list users too. Create `app/http/controllers/user_controller.py`:

```python
from app.http.resources.user import UserResource
from app.models.user import User


class UserController:
    async def index(self) -> list[UserResource]:
        users = await User.order_by("name").get()
        return [UserResource.model_validate(user) for user in users]
```

## 4. Add the routes

Open `routes/api.py`. Add the users route and let `resource()` turn on the two new project methods:

```python
from app.http.controllers.home_controller import HomeController
from app.http.controllers.project_controller import ProjectController
from app.http.controllers.user_controller import UserController # [!code ++]
from fastapi_startkit.fastapi import Router

controller = HomeController()
router = Router()
router.get("/", controller.index, response_model=None)
router.get("/health", controller.health)

api = Router(prefix="/api")
api.resource("projects", ProjectController, only=["index"]) # [!code --]
api.resource("users", UserController, only=["index"]) # [!code ++]
api.resource("projects", ProjectController, only=["index", "store", "show"]) # [!code ++]
```

`only=` now keeps the three routes you've written: `GET /api/projects`, `POST /api/projects` and `GET /api/projects/{project}`. Projects can't be edited or deleted in this course, so `update` and `destroy` stay off.

## Check

List the projects you seeded:

```bash
curl http://127.0.0.1:8000/api/projects
```

```json
[
  {"id": 2, "key": "APP", "name": "Mobile app", "description": null},
  {"id": 1, "key": "WEB", "name": "Website", "description": "The marketing site"}
]
```

Create one. You get `201` and the new project:

```bash
curl -X POST http://127.0.0.1:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"key": "OPS", "name": "Operations"}'
```

```json
{"id": 3, "key": "OPS", "name": "Operations", "description": null}
```

Now break the rules. A lowercase key and an empty name get a `422` that names both fields:

```bash
curl -X POST http://127.0.0.1:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"key": "ops", "name": ""}'
```

```json
{
  "message": "The key field format is invalid. (and 1 more error)",
  "errors": {
    "key": ["The key field format is invalid."],
    "name": ["The name field is required."]
  }
}
```

A key that's already taken is refused too:

```json
{"message": "The key has already been taken.", "errors": {"key": ["The key has already been taken."]}}
```

And `curl http://127.0.0.1:8000/api/projects/99` gets a `404`:

```json
{"detail": "Project with primary key 99 not found."}
```

::: info Compare your code
This lesson's code is tagged [`lesson-06`](https://github.com/fastapi-startkit/issue-tracker/tree/lesson-06). See [the changes in this lesson](https://github.com/fastapi-startkit/issue-tracker/compare/lesson-05...lesson-06).
:::
