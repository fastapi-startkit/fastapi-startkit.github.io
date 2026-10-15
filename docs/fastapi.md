---
outline: deep
title: FastAPI Provider
description: Register the FastAPI provider, configure the server, and define routes.
keywords: fastapi, dependency injection, service provider, container
---

# FastAPI Integration

`FastAPIProvider` creates your FastAPI application, registers the `serve` command, and routes exceptions through the framework's exception handler.

## Installation

Install the `fastapi` extra:

```bash
uv add fastapi-startkit --extra fastapi
# or
pip install "fastapi-startkit[fastapi]"
```

## Setup

Add `FastAPIProvider` to your providers:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.logging import LogProvider
from config.fastapi import FastAPIConfig

app: Application = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        LogProvider,
        (FastAPIProvider, FastAPIConfig),
    ]
)
```

## The FastAPI Provider

You don't need to write your own provider. Once registered, `FastAPIProvider` does the following:

- **`register()`** loads the FastAPI configuration, merging the config class you pass over the framework defaults, then creates the `FastAPI` instance and binds it into the container with `use_fastapi()`.
- **`boot()`** registers the `serve` command, sends `HTTPException`, request validation errors, and uncaught exceptions through the exception manager, adds `RequestLifecycleMiddleware`, and makes `config/fastapi.py` available to publish.

## Configuration

### Default Configuration

The `FastAPIConfig` dataclass holds the server settings:

| Field | Environment variable | Default | Purpose |
|---|---|---|---|
| `app_url` | `APP_URL` | `http://127.0.0.1:8000` | Host and port that `serve` binds to |
| `app` | — | `bootstrap.application:app` | Import path Uvicorn loads |
| `reload` | `APP_RELOAD` | `True` | Restart when code changes |
| `ws` | `APP_WS` | `auto` | Uvicorn WebSocket implementation |
| `reload_dirs` | — | `None` | Directories to watch; `None` uses Uvicorn's default |
| `reload_excludes` | — | `["*.log", "tests/*", "node_modules/*"]` | Glob patterns to ignore when watching |

Most applications only set `APP_URL` and `APP_RELOAD`:

```bash
# .env
APP_URL=http://127.0.0.1:8000
APP_RELOAD=true
```

### Publishing the Config

To change fields that have no environment variable, such as `reload_dirs` or `reload_excludes`, publish the config file:

```bash
uv run python artisan provider:publish --provider fastapi
```

This writes `config/fastapi.py`:

```python
# config/fastapi.py
import dataclasses

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env


@dataclasses.dataclass
class FastAPIConfig(Config):
    app_url: str = env("APP_URL", "http://127.0.0.1:8000")
    app: str = "bootstrap.application:app"
    reload: bool = env("APP_RELOAD", True)
    ws: str = env("APP_WS", "auto")
    reload_dirs: list | None = None
    reload_excludes: list = dataclasses.field(
        default_factory=lambda: [
            "*.log",
            "tests/*",
            "node_modules/*",
        ]
    )
```

Pass the class with the provider, as in [Setup](#setup). The provider merges it over the framework defaults in `register()`.

## Advanced: Customizing the Provider

To control the `FastAPI` instance yourself, for example to set the title and version or add middleware, write your own provider and register it instead of `FastAPIProvider`:

```python
# app/providers/fastapi_provider.py
from fastapi import FastAPI
from fastapi_startkit.support import Provider
from fastapi_startkit.fastapi.commands import ServeCommand

class MyFastAPIProvider(Provider):
    def register(self) -> None:
        fastapi = FastAPI(
            title="My Custom API",
            version="1.0.0",
        )

        self.app.use_fastapi(fastapi)

    def boot(self):
        self.commands([
            ServeCommand
        ])
```

A custom provider replaces the default one entirely, so register `ServeCommand` and any exception handlers you still need.

## Routing

You can use FastAPI's own `APIRouter`, or the framework's `Router`, which registers routes by method call instead of decorator.

### Standard FastAPI Routing

`APIRouter` works as described in the FastAPI docs:

```python
# routes/api.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def index():
    return {"message": "Hello, FastAPI!"}

@router.post("/items")
async def create_item(item: ItemSchema):
    return item
```

Include the router in your provider's `boot()` method:

```python
# app/providers/fastapi_provider.py
class MyFastAPIProvider(Provider):
    # ... register method ...

    def boot(self):
        self.commands([ServeCommand])

        from routes.api import router
        self.app.include_router(router)
```

### Startkit Router

`Router` takes the path and the endpoint as arguments, the way Laravel's route files do.

#### Defining Routes

Import `Router` from `fastapi_startkit.fastapi` and call a method helper with a path and an endpoint:

```python
# routes/web.py
from fastapi_startkit.fastapi import Router

router = Router()

router.get("/", dashboard_controller.index)
router.post("/login", auth_controller.store)
router.put("/users/{user_id}", users_controller.update)
router.patch("/users/{user_id}", users_controller.patch)
router.delete("/logout", auth_controller.destroy)
router.head("/health", health_controller.check)
router.options("/cors", cors_controller.preflight)
```

The helpers accept the keyword arguments of FastAPI's `add_api_route`:

```python
router.get(
    "/users",
    users_controller.index,
    tags=["users"],
    summary="List all users",
    response_model=list[UserSchema],
)
```

#### Resource Routes

`router.resource()` registers the standard CRUD routes for a controller:

| Route | HTTP method | Controller method |
|---|---|---|
| `/{name}` | GET | `index` |
| `/{name}/create` | GET | `create` |
| `/{name}` | POST | `store` |
| `/{name}/{param}` | GET | `show` |
| `/{name}/{param}/edit` | GET | `edit` |
| `/{name}/{param}` | PUT | `update` |
| `/{name}/{param}` | DELETE | `destroy` |

`{param}` is the resource name without its trailing `s`, so `users` gets `/users/{user}`. Rename it with `parameters`. The examples below name it `user_id`:

```python
from app.http.controllers import users_controller

router.resource("users", users_controller, parameters={"users": "user_id"})
```

The controller can be a module of functions or a class.

::: code-group

```python [Module]
# app/http/controllers/users_controller.py
async def index(request: Request):
    return await User.all()

async def show(user_id: int):
    return await User.find(user_id)

async def store(data: UserSchema):
    return await User.create(**data.model_dump())

async def update(user_id: int, data: UserSchema):
    user = await User.find(user_id)
    return await user.update(**data.model_dump())

async def destroy(user_id: int):
    user = await User.find(user_id)
    await user.delete()
```

```python [Class]
# app/http/controllers/users_controller.py
class UsersController:
    async def index(self, request: Request):
        return await User.all()

    async def show(self, user_id: int):
        return await User.find(user_id)

    async def store(self, data: UserSchema):
        return await User.create(**data.model_dump())

    async def update(self, user_id: int, data: UserSchema):
        user = await User.find(user_id)
        return await user.update(**data.model_dump())

    async def destroy(self, user_id: int):
        user = await User.find(user_id)
        await user.delete()
```

:::

Pass either one to `resource()`. A class is instantiated for you:

```python
# routes/web.py
from app.http.controllers import users_controller          # module
from app.http.controllers.users_controller import UsersController  # class

router.resource("users", users_controller, parameters={"users": "user_id"})   # module
router.resource("users", UsersController, parameters={"users": "user_id"})    # class
```

**Narrowing the registered routes**

Use `only` or `excepts` to register some of the actions:

```python
router.resource("users", users_controller, only={"index", "show"})

router.resource("users", users_controller, excepts={"create", "edit"})
```

**Custom route names and URL parameters**

```python
router.resource(
    "users",
    users_controller,
    names={"index": "user.list", "show": "user.detail"},
    parameters={"users": "user_id"},   # default would be "user"
)
```

#### Grouping Routes

To share options such as an auth dependency across routes, put them on their own `Router`:

```python
# routes/web.py
from fastapi import Depends
from fastapi_startkit.fastapi import Router
from app.http.middlewares.auth import auth

guest = Router()
guest.get("/login", auth_controller.create)
guest.post("/login", auth_controller.store)
guest.delete("/logout", auth_controller.destroy)

protected = Router(dependencies=[Depends(auth)])
protected.get("/", dashboard_controller.index)
protected.resource("users", users_controller)
protected.resource("organizations", organizations_controller)
protected.resource("contacts", contacts_controller)
protected.get("/reports", reports_controller.index)
```

`Router(...)` takes the same arguments as FastAPI's `APIRouter`, such as `prefix` and `dependencies`.

#### Registering Routers in Your Provider

Include each router in your provider's `boot()` method:

```python
# app/providers/fastapi_provider.py
class MyFastAPIProvider(Provider):
    # ... register method ...

    def boot(self):
        self.commands([ServeCommand])

        from routes.web import guest, protected
        self.app.include_router(guest)
        self.app.include_router(protected)
```

## Serving the Application

Start the server with `serve`. With a custom provider, register `ServeCommand` yourself.

```bash
uv run python artisan serve
```

`serve` runs Uvicorn with the `app_url`, `reload`, `reload_dirs`, and `reload_excludes` values from your [FastAPI configuration](#configuration).

## Example Application

See the [FastAPI example app](https://github.com/fastapi-startkit/fastapi-startkit-modules/tree/main/example/fastapi-app) for a complete project.
