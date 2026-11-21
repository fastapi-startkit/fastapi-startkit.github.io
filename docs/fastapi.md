---
outline: deep
title: FastAPI Provider
description: Register the FastAPI provider, configure the server, and define routes.
keywords: fastapi, dependency injection, service provider, container
---

# FastAPI Integration

The `FastAPIProvider` runs your FastAPI application inside the framework. It creates the FastAPI instance, registers the `serve` command and sends errors through the framework's [exception handler](/docs/exception-handling). You write routes and dependencies the way FastAPI documents them, and you can use the framework's `Router` to keep all your routes in one file.

## Installation

Install the framework with the `fastapi` extra:

```bash
uv add "fastapi-startkit[fastapi]"
# or
pip install "fastapi-startkit[fastapi]"
```

## Registering the Provider

Add `FastAPIProvider` to your application's providers. Pair it with a config class to change the [server settings](#configuration):

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIConfig, FastAPIProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        (FastAPIProvider, FastAPIConfig),
    ],
)
```

When the application boots, the provider:

- creates the `FastAPI` instance, titled with `APP_NAME`, and makes it available as `app.fastapi`;
- registers the `serve` command;
- sends `HTTPException`, request validation errors and uncaught exceptions to the [exception handler](/docs/exception-handling);
- adds the middleware that sets the `X-Request-Id` header (see [Tracking Requests](#tracking-requests));
- makes `config/fastapi.py` available to `provider:publish`.

## Defining Routes

You can define routes with FastAPI's `APIRouter` and its decorators, or with the framework's `Router`. `Router` takes the path and the endpoint as arguments, so your routes can sit together in one file:

```python
# routes/web.py
from fastapi_startkit.fastapi import Router


async def health():
    return {"status": "ok"}


router = Router()
router.get("/health", health)
```

`Router` has a method for each HTTP verb: `get`, `post`, `put`, `patch`, `delete`, `head` and `options`. Each one also accepts the keyword arguments of FastAPI's `add_api_route`:

```python
router.get("/health", health, tags=["system"], summary="Health check")
```

`APIRouter` works exactly as the FastAPI docs describe:

```python
# routes/api.py
from fastapi import APIRouter

api = APIRouter(prefix="/api")


@api.get("/orders/{order_id}")
async def show_order(order_id: int):
    return {"id": order_id, "status": "paid"}
```

## Resource Routes

`router.resource()` registers the CRUD routes for a controller in one call:

```python
router.resource("posts", posts_controller)
```

| Route | HTTP method | Controller method | Route name |
|---|---|---|---|
| `/posts` | GET | `index` | `posts` |
| `/posts/create` | GET | `create` | `posts.create` |
| `/posts` | POST | `store` | `posts.store` |
| `/posts/{post}` | GET | `show` | `posts.show` |
| `/posts/{post}/edit` | GET | `edit` | `posts.edit` |
| `/posts/{post}` | PUT | `update` | `posts.update` |
| `/posts/{post}` | DELETE | `destroy` | `posts.destroy` |

A route is registered only when the controller has the matching method. The path parameter is the resource name with every trailing `s` removed, so `posts` gets `{post}`. For names where that gives the wrong word, such as `addresses`, which gets `{addresse}`, set the parameter yourself with `parameters=` (see [Renaming Routes and Parameters](#renaming-routes-and-parameters)).

### Writing Controllers

A controller is a module of functions or a class. The endpoints are ordinary FastAPI endpoints, so they take path parameters, request bodies and dependencies:

::: code-group

```python [Module]
# app/http/controllers/posts_controller.py
from pydantic import BaseModel

POSTS = {1: {"id": 1, "title": "Hello"}}


class PostData(BaseModel):
    title: str


async def index():
    return list(POSTS.values())


async def show(post_id: int):
    return POSTS[post_id]


async def store(data: PostData):
    post = {"id": len(POSTS) + 1, "title": data.title}
    POSTS[post["id"]] = post
    return post


async def update(post_id: int, data: PostData):
    POSTS[post_id]["title"] = data.title
    return POSTS[post_id]


async def destroy(post_id: int):
    POSTS.pop(post_id)
    return {"deleted": post_id}
```

```python [Class]
# app/http/controllers/comments_controller.py
class CommentsController:
    async def index(self):
        return [{"id": 1, "body": "Nice post"}]

    async def show(self, comment: int):
        return {"id": comment, "body": "Nice post"}
```

:::

Pass either one to `resource()`. A class is instantiated for you:

```python
# routes/web.py
from app.http.controllers import posts_controller
from app.http.controllers.comments_controller import CommentsController

router.resource("posts", posts_controller, parameters={"posts": "post_id"})
router.resource("comments", CommentsController)
```

### Choosing the Routes

Use `only` or `excepts` to register a subset of the actions:

```python
router.resource("posts", posts_controller, excepts={"create", "edit"})
router.resource("comments", CommentsController, only={"index", "show"})
```

### Renaming Routes and Parameters

`names` maps an action to a route name, and `parameters` maps the resource name to a path parameter name. The parameter name must match the argument of your controller methods, like `post_id` above:

```python
router.resource(
    "posts",
    posts_controller,
    names={"index": "posts.list"},
    parameters={"posts": "post_id"},
)
```

## Grouping Routes

`Router` accepts the same arguments as FastAPI's `APIRouter`, such as `prefix` and `dependencies`. Put routes that share them on their own router:

```python
# routes/web.py
from fastapi import Depends, Header, HTTPException

from app.http.controllers import posts_controller
from app.http.controllers.comments_controller import CommentsController
from fastapi_startkit.fastapi import Router


async def require_token(authorization: str = Header(default="")):
    if authorization != "Bearer secret":
        raise HTTPException(status_code=401, detail="Unauthenticated")


async def health():
    return {"status": "ok"}


public = Router()
public.get("/health", health)

admin = Router(prefix="/admin", dependencies=[Depends(require_token)])
admin.resource("posts", posts_controller, parameters={"posts": "post_id"}, excepts={"create", "edit"})
admin.resource("comments", CommentsController, only={"index", "show"})
```

Every route on `admin` now starts with `/admin` and returns a 401 without the token.

## Registering Routes in Your Provider

To add your routes, extend `FastAPIProvider` in your project, call `super().boot()`, and include each router. Pass a `Router`'s `.router` attribute to `include_router()`:

```python
# providers/fastapi_provider.py
from fastapi_startkit.fastapi import FastAPIProvider


class AppFastAPIProvider(FastAPIProvider):
    def boot(self):
        super().boot()

        from routes.web import admin, public

        self.app.include_router(public.router)
        self.app.include_router(admin.router)
```

An `APIRouter` is passed as it is, for example `self.app.include_router(api)`. Register your provider in place of `FastAPIProvider`:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIConfig
from providers.fastapi_provider import AppFastAPIProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[(AppFastAPIProvider, FastAPIConfig)],
)
```

## Customizing the FastAPI Instance

To change the FastAPI instance, override `register()` in the same provider and call `super().register()` first. Add middleware in `boot()`:

```python
# providers/fastapi_provider.py
from fastapi.middleware.cors import CORSMiddleware

from fastapi_startkit.fastapi import FastAPIProvider


class AppFastAPIProvider(FastAPIProvider):
    def register(self) -> None:
        super().register()
        self.app.fastapi.title = "Billing API"
        self.app.fastapi.version = "2.0.0"

    def boot(self):
        super().boot()
        self.app.add_middleware(CORSMiddleware, allow_origins=["https://billing.example.com"])

        from routes.api import api

        self.app.include_router(api)
```

`app.add_middleware()`, `app.mount()`, `app.add_exception_handler()` and `app.add_event_handler()` pass through to the FastAPI instance, and `app.fastapi` returns the instance itself.

## Configuration

The server settings live in `FastAPIConfig`:

| Field | Environment variable | Default | Purpose |
|---|---|---|---|
| `title` | `APP_NAME` | `FastAPI Startkit` | Title of the FastAPI instance and its OpenAPI docs |
| `app_url` | `APP_URL` | `http://127.0.0.1:8000` | Host and port that `serve` binds to |
| `app` | | `bootstrap.application:app` | Import path Uvicorn loads |
| `reload` | `APP_RELOAD` | `True` | Restart when code changes |
| `ws` | `APP_WS` | `auto` | Uvicorn WebSocket implementation: `auto`, `none`, `websockets`, `websockets-sansio` or `wsproto` |
| `reload_dirs` | | `None` | Directories to watch; `None` uses Uvicorn's default |
| `reload_excludes` | | `["*.log", "tests/*", "node_modules/*"]` | Glob patterns to ignore when watching |

Most applications only set the environment variables:

```ini
# .env
APP_URL=http://127.0.0.1:8000
APP_RELOAD=true
```

The values are available through the `Config` facade under the `fastapi` key, for example `Config.get("fastapi.app_url")`. See [Configuration](/docs/configuration#accessing-configuration-values).

### Publishing the Config

To change a field without an environment variable, such as `reload_dirs`, publish the config file:

```bash
uv run python artisan provider:publish --provider fastapi
```

This copies the framework's `FastAPIConfig` class, with every field, to `config/fastapi.py`. Edit the fields you need, import the class from `config.fastapi` and pass it with the provider, as shown in [Registering the Provider](#registering-the-provider).

You can also skip publishing and extend the framework's class with only the fields you change:

```python
# config/fastapi.py
from dataclasses import dataclass, field

from fastapi_startkit.fastapi import FastAPIConfig as BaseFastAPIConfig


@dataclass
class FastAPIConfig(BaseFastAPIConfig):
    reload_dirs: list | None = field(default_factory=lambda: ["app", "routes"])
```

## Serving the Application

Start the development server with `serve`:

```bash
uv run python artisan serve
```

`serve` runs Uvicorn with the values from your [configuration](#configuration). Options on the command line override them:

| Option | Overrides |
|---|---|
| `--host` | The host from `app_url` |
| `--port`, `-p` | The port from `app_url` |
| `--reload`, `-r` | `reload`; pass `true` or `false` |
| `--app`, `-a` | `app` |
| `--ws` | `ws` |

```bash
uv run python artisan serve --host 0.0.0.0 --port 8080 --reload false
```

If `serve` can't import the module named in `app`, it prints a warning and serves the running instance without reloading. To run Uvicorn yourself, see [Running with Uvicorn](/docs/getting-started#running-with-uvicorn).

## Tracking Requests

Every response carries an `X-Request-Id` header. The provider reuses the ID from the incoming request's `X-Request-Id` header or generates one. After each request it dispatches a `RequestHandled` event with the `method`, `path`, `status_code`, `duration_ms` and `request_id`:

```python
from fastapi_startkit.facades import Event
from fastapi_startkit.fastapi import RequestHandled


def log_request(event: RequestHandled):
    print(f"{event.method} {event.path} {event.status_code} {event.duration_ms:.1f}ms [{event.request_id}]")


Event.listen(RequestHandled, log_request)
```

See [FastAPI Testing](/docs/testing/fastapi) to test your routes, and the [FastAPI example app](https://github.com/fastapi-startkit/fastapi-startkit/tree/main/example/fastapi-app) for a complete project.
