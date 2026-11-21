---
lesson: 4
title: Routes and controllers
description: Add a controller, give it routes with a router and connect the router to FastAPI.
duration: 6
---

# Routes and controllers

Controllers hold the code that handles requests, and routers map URLs to them. In this lesson you add a `GET /api/projects` endpoint served by a controller.

## 1. Write a Controller

A controller is a class whose methods handle requests. Create `app/http/controllers/project_controller.py`:

```python
class ProjectController:
    async def index(self):
        return [
            {"id": 1, "key": "WEB", "name": "Website"},
            {"id": 2, "key": "APP", "name": "Mobile app"},
        ]
```

The list is made up for now. You'll read real projects from the database in lesson 6.

## 2. Add the Routes

Open `routes/api.py`. The installer already made a `router` for `/` and `/health`. Add a second router for your API:

```python
from app.http.controllers.home_controller import HomeController
from app.http.controllers.project_controller import ProjectController # [!code ++]
from fastapi_startkit.fastapi import Router

controller = HomeController()
router = Router()
router.get("/", controller.index, response_model=None)
router.get("/health", controller.health)

api = Router(prefix="/api") # [!code ++]
api.resource("projects", ProjectController, only=["index"]) # [!code ++]
```

`Router(prefix="/api")` puts every route on this router under `/api`.

`resource()` builds the usual routes for a resource from one line. Each route calls the controller method with the same name:

| Method | Path | Controller method |
|---|---|---|
| GET | `/api/projects` | `index` |
| POST | `/api/projects` | `store` |
| GET | `/api/projects/{project}` | `show` |
| PUT | `/api/projects/{project}` | `update` |
| DELETE | `/api/projects/{project}` | `destroy` |

For a controller with `create` and `edit` methods, it also adds `GET /api/projects/create` and `GET /api/projects/{project}/edit`. A route is only added when the controller has its method.

`only=["index"]` keeps the first one until the other methods exist. In lesson 6 you'll add `store` and `show` to the list.

## 3. Connect the Router to FastAPI

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

`boot()` runs after every provider has registered, so everything your controllers need is ready when the routes are imported.

## Check

```bash
curl http://127.0.0.1:8000/api/projects
```

```json
[
  {"id": 1, "key": "WEB", "name": "Website"},
  {"id": 2, "key": "APP", "name": "Mobile app"}
]
```

`GET /api/projects` also shows up on the `/docs` page now.

::: info Compare your code
This lesson's code is tagged [`lesson-04`](https://github.com/fastapi-startkit/issue-tracker/tree/lesson-04). See [the changes in this lesson](https://github.com/fastapi-startkit/issue-tracker/compare/lesson-03...lesson-04).
:::
