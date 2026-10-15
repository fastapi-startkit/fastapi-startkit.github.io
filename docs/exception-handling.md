---
outline: deep
title: Exception Handling
description: Report exceptions and turn them into HTTP responses with the ExceptionHandler.
keywords: error handling, exceptions, fastapi, debugging
---

# Exception Handling

Every exception, whether it comes from an HTTP request or a CLI command, goes through one `ExceptionHandler`. The handler reports it (logs it or sends it to a tracker) and, for HTTP requests, renders it into a response.

## Overview

```
ExceptionHandler
├── report()    — logs/tracks the exception
└── render()    — converts the exception into an HTTP response
```

FastAPI calls `handle()`, which runs `report()` and then `render()`.

## Setup

Subclass `ExceptionHandler` and pass your class to `Application`:

```python
# bootstrap/application.py
from fastapi_startkit import Application
from fastapi_startkit.exceptions import ExceptionHandler as BaseHandler
from starlette.responses import RedirectResponse

class ExceptionHandler(BaseHandler):
    def register(self):
        self.register_render(
            NotAuthenticated,
            lambda request, exc: RedirectResponse(url="/login", status_code=303),
        )

app = Application(
    base_path=...,
    exception_handler=ExceptionHandler,
)
```

The application calls `register()` while it boots. Register your renderers and reporters there.

## Registering Renders

A renderer takes the request and the exception and returns a `Response`:

```python
def register(self):
    self.register_render(
        PaymentRequiredException,
        lambda request, exc: JSONResponse({"error": str(exc)}, status_code=402),
    )
```

Renderers match the **exact** exception type. An exception with no renderer goes to the [handler objects](#handler-objects). `FastAPIProvider` registers handler objects for `Exception`, `HTTPException`, and `RequestValidationError`, so every exception raised during a request gets a response.

## Registering Reports

A reporter takes the exception. Use one to send exceptions to Sentry, Datadog, or a similar service:

```python
def register(self):
    self.register_report(
        Exception,
        lambda exc: sentry_sdk.capture_exception(exc),
    )
```

Reporters also match the exact type. This one runs for `Exception` itself, not for subclasses such as `ValueError`.

## Suppressing Reports

Pass expected exceptions, such as 404s and auth redirects, to `dont_report()` to keep them out of the logs:

```python
def register(self):
    self.dont_report([NotAuthenticated, ModelNotFoundException])
```

## Handler Objects

When a lambda isn't enough, register an object with a `report(exc)` method, a `render(request, exc)` method, or both:

```python
class MyHandler:
    def report(self, exc):
        sentry_sdk.capture_exception(exc)

    async def render(self, request, exc):
        return JSONResponse({"error": str(exc)}, status_code=500)

def register(self):
    self.register_handler(MyException, MyHandler())
```

Handler objects match subclasses too: the handler registered for the closest parent class wins. `FastAPIProvider` registers its own handlers for `Exception`, `HTTPException`, and `RequestValidationError` after your `register()` runs, replacing any you registered for those three types.

## How It Wires to FastAPI

`FastAPIProvider.boot()` adds exception handlers to the FastAPI instance for you:

```python
self.app.fastapi.add_exception_handler(HTTPException, handler)
self.app.fastapi.add_exception_handler(RequestValidationError, handler)
self.app.fastapi.add_exception_handler(Exception, handler)
```

Every unhandled exception in a request then goes through `exception_manager.handle(exc, {"request": request})`.

## CLI Context

Outside HTTP, `install()` points `sys.excepthook` at `report()`. Nothing is rendered because there is no request. `KeyboardInterrupt` goes to Python's default hook unchanged.

## Built-in Exception Types

The framework includes these exceptions. `ModelNotFoundException` is imported from `fastapi_startkit.masoniteorm`; the others are in `fastapi_startkit.exceptions`.

| Exception | Status |
|---|---|
| `ModelNotFoundException` | 404 |
| `AuthorizationException` | 403 |
| `RouteNotFoundException` | 404 |
| `MethodNotAllowedException` | 405 |
| `ThrottleRequestsException` | 429 |

Each has `get_status()` and `get_response()`, and some have `get_headers()`. Use them in a renderer:

```python
self.register_render(
    ModelNotFoundException,
    lambda req, exc: JSONResponse(
        {"error": exc.get_response()},
        status_code=exc.get_status(),
    ),
)
```
