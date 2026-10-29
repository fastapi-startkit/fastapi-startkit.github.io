---
lesson: 4
title: Routes and controllers
description: Add a controller, give it routes with a router and connect the router to FastAPI.
duration: 6
---

# Routes and controllers

**Goal:** a `GET /api/tasks` endpoint, served by a controller.

## 1. Write a controller

A controller is a class whose methods handle requests. Create `app/http/controllers/task_controller.py`:

```python
class TaskController:
    async def index(self):
        return [
            {"id": 1, "title": "Draft the homepage copy", "completed": False},
            {"id": 2, "title": "Pick a color palette", "completed": True},
        ]
```

The list is made up for now. You'll read real tasks from the database in lesson 6.

## 2. Add the routes

Open `routes/api.py`. The installer already made a `router` for `/` and `/health`. Add a second router for your API:

```python
from app.http.controllers.home_controller import HomeController
from app.http.controllers.task_controller import TaskController # [!code ++]
from fastapi_startkit.fastapi import Router

controller = HomeController()
router = Router()
router.get("/", controller.index, response_model=None)
router.get("/health", controller.health)

api = Router(prefix="/api") # [!code ++]
api.resource("tasks", TaskController, only=["index"]) # [!code ++]
```

`Router(prefix="/api")` puts every route on this router under `/api`.

`resource()` builds the usual routes for a resource from one line. Each route calls the controller method with the same name:

| Method | Path | Controller method |
|---|---|---|
| GET | `/api/tasks` | `index` |
| POST | `/api/tasks` | `store` |
| GET | `/api/tasks/{task}` | `show` |
| PUT | `/api/tasks/{task}` | `update` |
| DELETE | `/api/tasks/{task}` | `destroy` |

`only=["index"]` keeps just the first one until the other methods exist. You'll remove it in lesson 8.

## 3. Connect the router to FastAPI

A router does nothing until it's added to FastAPI. That happens in `providers/fastapi_provider.py`:

```python
from fastapi_startkit.fastapi import FastAPIProvider


class FastapiProvider(FastAPIProvider):
    def boot(self):
        super().boot()
        from routes.api import router # [!code --]
        from routes.api import api, router # [!code ++]

        self.app.fastapi.include_router(router.router)
        self.app.fastapi.include_router(api.router) # [!code ++]
```

`boot()` runs after every provider has registered, so everything your controllers need is ready by then. The import sits inside `boot()` for the same reason.

## Check

```bash
curl http://127.0.0.1:8000/api/tasks
```

```json
[
  {"id": 1, "title": "Draft the homepage copy", "completed": false},
  {"id": 2, "title": "Pick a color palette", "completed": true}
]
```

`GET /api/tasks` also shows up on the `/docs` page now.
