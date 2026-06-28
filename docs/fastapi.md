---
outline: deep
title: FastAPI Provider
description: Understanding the FastAPI provider and how it integrates with the service container.
keywords: fastapi, dependency injection, service provider, container
---

# FastAPI Integration

Fastapi Startkit provides a seamless way to integrate and bootstrap FastAPI applications. By using the `FastAPIProvider`, you can maintain a clean separation between your application logic and the framework's configuration.

## Installation

To use FastAPI Integration, you need to install the `fastapi` extra:

```bash
uv add fastapi-startkit --extra fastapi
# or
pip install "fastapi-startkit[fastapi]"
```

## Setup

To enable FastAPI support, register the `FastAPIProvider` in your application providers list.

```python
# bootstrap/application.py
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

app: Application = Application(
    base_path=...,
    providers=[
        FastAPIProvider,
        # ... other providers
    ]
)
```

## The FastAPI Provider

The `FastAPIProvider` shipped with Fastapi Startkit is the default, batteries-included entry point. Once registered (see [Setup](#setup)), it configures everything needed to run a FastAPI application — you do **not** need to write your own provider to get started.

Across its two boot phases it:

- **`register()`** — loads the FastAPI configuration (merging your published `config/fastapi.py` over the framework defaults) and creates the `FastAPI` instance, binding it into the application container via `use_fastapi()`.
- **`boot()`** — registers the `serve` console command, wires the framework's exception handlers (so `HTTPException`, request-validation errors, and otherwise uncaught exceptions are rendered through the exception manager), and publishes the default `config/fastapi.py` so you can export and edit it.

Registering `FastAPIProvider` in your providers list is all that is required — the FastAPI instance, the `serve` command, and exception handling are wired up for you.

## Configuration

### Default Configuration

FastAPI settings are defined by the `FastAPIConfig` dataclass, with values sourced from environment variables:

| Field | Environment variable | Default |
|---|---|---|
| `app_url` | `APP_URL` | `http://127.0.0.1:8000` |
| `reload` | `APP_RELOAD` | `True` |
| `reload_dirs` | — | `None` |
| `reload_excludes` | — | `["*.log", "tests/*", "node_modules/*"]` |

- `app_url` — the host and port the `serve` command binds to.
- `reload` — whether Uvicorn watches for code changes and restarts automatically.
- `reload_dirs` — an optional list of directories to watch; `None` lets Uvicorn use its default.
- `reload_excludes` — glob patterns Uvicorn ignores while watching for changes.

For most applications, setting `APP_URL` and `APP_RELOAD` in your `.env` is all you need:

```bash
# .env
APP_URL=http://127.0.0.1:8000
APP_RELOAD=true
```

### Publishing the Config

To customise the configuration beyond environment variables — for example to change `reload_dirs` or `reload_excludes` — export the default config file into your project with the `provider:publish` command:

```bash
uv run artisan provider:publish --provider fastapi
```

This copies the framework's default configuration into your project at `config/fastapi.py`, where you can edit it directly:

```python
# config/fastapi.py
import dataclasses

from fastapi_startkit.environment import env


@dataclasses.dataclass
class FastAPIConfig:
    app_url: str = dataclasses.field(default_factory=lambda: env("APP_URL", "http://127.0.0.1:8000"))
    reload: bool = dataclasses.field(default_factory=lambda: env("APP_RELOAD", True))
    reload_dirs: list | None = None
    reload_excludes: list = dataclasses.field(
        default_factory=lambda: [
            "*.log",
            "tests/*",
            "node_modules/*",
        ]
    )
```

The provider merges this file over the framework defaults at boot, so you only need to keep the fields you want to override.

## Advanced: Customizing the Provider

The default provider is enough for most applications. If you need full control over the `FastAPI` instance — for example to change the title and version, or to add custom middleware — you can write your own provider and register it in place of `FastAPIProvider`:

```python
# app/providers/fastapi_provider.py
from fastapi import FastAPI
from fastapi_startkit.providers import Provider
from fastapi_startkit.fastapi.commands import ServeCommand

class MyFastAPIProvider(Provider):
    def register(self) -> None:
        """Create a FastAPI instance and register it."""
        fastapi = FastAPI(
            title="My Custom API",
            version="1.0.0",
        )

        # Register the instance with the application
        self.app.use_fastapi(fastapi)

    def boot(self):
        # Register core commands like 'serve'
        self.commands([
            ServeCommand
        ])
```

When you supply your own provider you take over instance creation, so remember to register any commands (such as `ServeCommand`) and exception handlers you still want.

## Routing

Fastapi Startkit supports the standard FastAPI routing approach as well as a `Router` wrapper that adds a more expressive, MVC-style API on top.

### Standard FastAPI Routing

You can use FastAPI's `APIRouter` with decorators exactly as the FastAPI docs describe:

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

Register the router in your provider's `boot` method:

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

Fastapi Startkit also ships a `Router` wrapper that lets you register routes imperatively — passing the path and endpoint as arguments instead of using decorators. This style is closer to how MVC frameworks handle routing.

#### Defining Routes

Import `Router` from `fastapi_startkit.fastapi` and register routes by calling HTTP method helpers with a path and an endpoint callable:

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

All method helpers accept the same keyword options as FastAPI's `add_api_route` (e.g. `response_model`, `status_code`, `tags`, `dependencies`, `summary`, `deprecated`, etc.):

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

`router.resource()` registers the full set of conventional CRUD routes for a controller in one call:

| Route | HTTP method | Controller method |
|---|---|---|
| `/{name}` | GET | `index` |
| `/{name}/create` | GET | `create` |
| `/{name}` | POST | `store` |
| `/{name}/{id}` | GET | `show` |
| `/{name}/{id}/edit` | GET | `edit` |
| `/{name}/{id}` | PUT | `update` |
| `/{name}/{id}` | DELETE | `destroy` |

```python
from app.http.controllers import users_controller

router.resource("users", users_controller)
```

The controller can be a **module** (functions at the top level) or a **class** — both work.

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

Then register with `resource()` — the same call works for either style:

```python
# routes/web.py
from app.http.controllers import users_controller          # module
from app.http.controllers.users_controller import UsersController  # class

router.resource("users", users_controller)        # module
router.resource("users", UsersController)         # class (instantiated automatically)
```

**Narrowing the registered routes**

Use `only` or `excepts` to register a subset of the standard actions:

```python
# Only register index and show
router.resource("users", users_controller, only={"index", "show"})

# Register everything except create and edit (view-only form pages)
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

Create separate `Router` instances to apply shared configuration — such as auth dependencies — to a group of routes:

```python
# routes/web.py
from fastapi import Depends
from fastapi_startkit.fastapi import Router
from app.http.middlewares.auth import auth

# Public routes — no auth required
guest = Router()
guest.get("/login", auth_controller.create)
guest.post("/login", auth_controller.store)
guest.delete("/logout", auth_controller.destroy)

# Protected routes — auth dependency applied to every route
protected = Router(dependencies=[Depends(auth)])
protected.get("/", dashboard_controller.index)
protected.resource("users", users_controller)
protected.resource("organizations", organizations_controller)
protected.resource("contacts", contacts_controller)
protected.get("/reports", reports_controller.index)
```

`Router(...)` accepts all the same constructor options as FastAPI's `APIRouter` (e.g. `prefix`, `tags`, `dependencies`, `responses`, `deprecated`, `include_in_schema`).

#### Registering Routers in Your Provider

Include each router in your provider's `boot` method:

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

The default `FastAPIProvider` registers the `serve` CLI command for you (when you use a custom provider, register `ServeCommand` yourself). Start the server with:

```bash
uv run artisan serve
```

This command uses Uvicorn to start your application, honouring the `app_url`, `reload`, `reload_dirs`, and `reload_excludes` values from your [FastAPI configuration](#configuration).

## Example Application

You can find a complete example of a FastAPI application built with Fastapi Startkit in our [example repository](https://github.com/fastapi-startkit/fastapi-startkit-modules/tree/main/example/fastapi-app).
