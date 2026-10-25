---
outline: deep
title: Exception Handling
description: Report exceptions and turn them into HTTP responses with the ExceptionHandler.
keywords: error handling, exceptions, fastapi, debugging
---

# Exception Handling

Errors happen, and when they do you want two things: a record of what went wrong, and a sensible response for whoever triggered it. FastAPI Startkit routes every exception, whether it comes from an HTTP request or a CLI command, through a single `ExceptionHandler`. The handler reports the exception (logging it or sending it to a tracker) and, for HTTP requests, renders it into a response. Because it all happens in one place, you can decide how each kind of error is handled without scattering `try`/`except` blocks through your code.

## Overview

```
ExceptionHandler
├── report()    — logs/tracks the exception
└── render()    — converts the exception into an HTTP response
```

When an exception reaches FastAPI, it calls `handle()`, which runs `report()` and then `render()`.

## Setup

To customise the handler, subclass `ExceptionHandler` and pass your class to `Application`:

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

The application calls `register()` while it boots, so that's where your renderers and reporters belong.

## Registering Renders

A renderer takes the request and the exception and returns a `Response`:

```python
def register(self):
    self.register_render(
        PaymentRequiredException,
        lambda request, exc: JSONResponse({"error": str(exc)}, status_code=402),
    )
```

Renderers match the exact exception type. An exception without a renderer falls through to the [handler objects](#handler-objects). `FastAPIProvider` registers handler objects for `Exception`, `HTTPException`, and `RequestValidationError`, so every exception raised during a request gets a response.

## Registering Reports

A reporter receives the exception. This is where you'd send exceptions to Sentry, Datadog, or a similar service:

```python
def register(self):
    self.register_report(
        Exception,
        lambda exc: sentry_sdk.capture_exception(exc),
    )
```

Like renderers, reporters match the exact type. The one above runs for `Exception` itself, not for subclasses such as `ValueError`.

## Suppressing Reports

Some exceptions are part of normal operation, such as 404s and auth redirects. Pass them to `dont_report()` to keep them out of your logs:

```python
def register(self):
    self.dont_report([NotAuthenticated, ModelNotFoundException])
```

## Handler Objects

When a lambda isn't enough, you can register an object with a `report(exc)` method, a `render(request, exc)` method, or both:

```python
class MyHandler:
    def report(self, exc):
        sentry_sdk.capture_exception(exc)

    async def render(self, request, exc):
        return JSONResponse({"error": str(exc)}, status_code=500)

def register(self):
    self.register_handler(MyException, MyHandler())
```

Unlike renderers and reporters, handler objects match subclasses too, and the handler registered for the closest parent class wins. `FastAPIProvider` registers its own handlers for `Exception`, `HTTPException`, and `RequestValidationError` after your `register()` runs, replacing any you registered for those three types.

## How It Wires to FastAPI

You don't need to wire anything up yourself. `FastAPIProvider.boot()` adds exception handlers to the FastAPI instance for you:

```python
self.app.fastapi.add_exception_handler(HTTPException, handler)
self.app.fastapi.add_exception_handler(RequestValidationError, handler)
self.app.fastapi.add_exception_handler(Exception, handler)
```

From then on, every unhandled exception in a request goes through `exception_manager.handle(exc, {"request": request})`.

## CLI Context

Outside HTTP, `install()` points `sys.excepthook` at `report()`. Nothing is rendered, since there's no request to respond to. `KeyboardInterrupt` goes to Python's default hook unchanged.

## Built-in Exception Types

The framework ships with a handful of exceptions you can raise or handle. `ModelNotFoundException` is imported from `fastapi_startkit.masoniteorm`; the others are in `fastapi_startkit.exceptions`.

| Exception | Status |
|---|---|
| `ModelNotFoundException` | 404 |
| `AuthorizationException` | 403 |
| `RouteNotFoundException` | 404 |
| `MethodNotAllowedException` | 405 |
| `ThrottleRequestsException` | 429 |

Each one has `get_status()` and `get_response()`, and some also have `get_headers()`. You can use them in a renderer:

```python
self.register_render(
    ModelNotFoundException,
    lambda req, exc: JSONResponse(
        {"error": exc.get_response()},
        status_code=exc.get_status(),
    ),
)
```
