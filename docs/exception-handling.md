# Exception Handling

The framework provides a centralized `ExceptionHandler` that handles reporting (logging) and rendering (HTTP responses) for exceptions across both web and CLI contexts.

## Overview

```
ExceptionHandler
├── report()    — logs/tracks the exception
└── render()    — converts the exception into an HTTP response
```

`handle()` is the main entry point called by FastAPI. It calls both `report()` and `render()` in sequence.

---

## Setup

Pass a custom handler class when creating your `Application`:

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

`register()` is called automatically during application boot. Wire your renders and reports there.

---

## Registering Renders

A render callable converts an exception into a Starlette/FastAPI `Response`.

```python
# Signature: (request, exc) -> Response
def register(self):
    self.register_render(
        PaymentRequiredException,
        lambda request, exc: JSONResponse({"error": str(exc)}, status_code=402),
    )
```

Renders are matched by **exact type**. If no render is found for the exception, `render()` returns `None` and FastAPI falls back to its own default error handling.

---

## Registering Reports

Custom reporters let you send exceptions to external services (Sentry, Datadog, etc.):

```python
def register(self):
    self.register_report(
        Exception,
        lambda exc: sentry_sdk.capture_exception(exc),
    )
```

---

## Suppressing Reports

Use `dont_report()` to skip logging for expected exceptions (e.g. 404s, auth redirects):

```python
def register(self):
    self.dont_report([NotAuthenticated, ModelNotFoundException])
```

---

## Handler Objects

For complex logic, register a handler object that implements `report(exc)` and/or `render(request, exc)`:

```python
class MyHandler:
    def report(self, exc):
        sentry_sdk.capture_exception(exc)

    async def render(self, request, exc):
        return JSONResponse({"error": str(exc)}, status_code=500)

def register(self):
    self.register_handler(MyException, MyHandler())
```

Handler objects support MRO resolution — a handler registered for `Exception` will also match subclasses unless a more specific handler exists.

---

## How It Wires to FastAPI

`FastAPIProvider.boot()` registers a catch-all exception handler on the FastAPI instance:

```python
# Happens automatically — no action needed
self.app.fastapi.add_exception_handler(Exception, handler)
```

This means every unhandled exception in a request is passed through `exception_manager.handle(exc, {"request": request})`.

---

## CLI Context

In CLI (non-HTTP) contexts, `install()` wires `sys.excepthook` to call `report()` directly. The render path is never reached because there is no HTTP request. `KeyboardInterrupt` is passed through to the default hook unchanged.

---

## Built-in Exception Types

The framework ships several typed exceptions in `fastapi_startkit.exceptions`:

| Exception | Status |
|---|---|
| `ModelNotFoundException` | 404 |
| `AuthorizationException` | 403 |
| `RouteNotFoundException` | 404 |
| `MethodNotAllowedException` | 405 |
| `ThrottleRequestsException` | 429 |

These carry `get_status()`, `get_response()`, and optionally `get_headers()` methods that your render callables can use:

```python
self.register_render(
    ModelNotFoundException,
    lambda req, exc: JSONResponse(
        {"error": exc.get_response()},
        status_code=exc.get_status(),
    ),
)
```
