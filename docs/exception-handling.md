---
outline: deep
title: Exception Handling
description: Report exceptions and turn them into HTTP responses with the ExceptionHandler.
keywords: error handling, exceptions, fastapi, debugging
---

# Exception Handling

Every exception your application doesn't catch goes through a single `ExceptionHandler`. The handler does two things: it **reports** the exception, by logging it or sending it to an error tracker, and for HTTP requests it **renders** the exception into a response. Because both happen in one place, you can decide how each kind of error is handled without scattering `try`/`except` blocks through your routes.

## How Exceptions Are Handled

When you register `FastAPIProvider`, every exception raised during a request is passed to the handler, which reports it and then renders a response. Without any configuration you get this behaviour:

- An `HTTPException` from FastAPI or Starlette, or one of the framework's [HTTP exceptions](#built-in-exception-types), becomes a JSON response with its status code, its headers and a `detail` message. For example, `await User.find_or_fail(7)` with no matching row returns status `404` and `{"detail": "User with primary key 7 not found."}`.
- Exceptions with a status below `500` aren't reported. A `404` or a `403` is a normal outcome, not something to log.
- Validation errors on an Inertia request redirect back to the previous page with a `303` and the errors in the session, whatever its headers. Other requests get a `422` response with a `{"message": ..., "errors": {...}}` body when their `Accept` or `Content-Type` header is JSON, and are otherwise redirected back to the previous page with a `303` and the errors in the session. See [Validation](/docs/validation).
- Any other exception is reported and returns a `500` response.

Reporting writes the exception to the `Log` facade at the `error` level when `LogProvider` is registered, and prints it to stderr otherwise. See [Logging](/docs/logging) to choose where those messages go.

The `500` response depends on the `APP_DEBUG` environment variable. In debug mode, the body contains the exception message, class, file, line and stack trace. With `APP_DEBUG=false`, the body is `{"message": "Server Error"}`.

::: warning
`APP_DEBUG` defaults to `true`. Set `APP_DEBUG=false` in production so stack traces and file paths aren't sent to your users.
:::

## Customizing the Handler

To change how exceptions are reported or rendered, extend `ExceptionHandler` and pass your class to `Application`. Put your rules in the `register()` method, which the application calls while it boots:

```python
# bootstrap/application.py
from pathlib import Path

from starlette.responses import RedirectResponse

from fastapi_startkit import Application
from fastapi_startkit.exceptions import ExceptionHandler as BaseHandler
from fastapi_startkit.fastapi import FastAPIProvider

from app.exceptions import NotAuthenticated


class ExceptionHandler(BaseHandler):
    def register(self):
        self.register_render(
            NotAuthenticated,
            lambda request, exc: RedirectResponse(url="/login", status_code=303),
        )


app = Application(
    base_path=Path(__file__).parent.parent,
    providers=[FastAPIProvider],
    exception_handler=ExceptionHandler,
)
```

A request that raises `NotAuthenticated` now redirects to `/login` with a `303` status.

## Registering Renders

A renderer receives the request and the exception and returns a response. Register it with `register_render()`:

```python
from starlette.responses import JSONResponse

def register(self):
    self.register_render(
        PaymentRequired,
        lambda request, exc: JSONResponse({"error": str(exc)}, status_code=402),
    )
```

Raising `PaymentRequired("Your trial has ended.")` now returns `{"error": "Your trial has ended."}` with status `402`. The renderer may also be an `async` function.

Renderers match the exact exception class, so the renderer above doesn't run for subclasses of `PaymentRequired`. A renderer takes priority over the default rendering described above.

## Registering Reports

A reporter receives the exception. Use `register_report()` to send a specific exception to an error tracker, or to log it differently:

```python
from fastapi_startkit.logging import Log

def register(self):
    self.register_report(
        PaymentRequired,
        lambda exc: Log.warning(f"Payment required: {exc}"),
    )
```

Like renderers, reporters match the exact exception class. A reporter replaces the default reporting for that class.

### Reporting Every Server Error

To send every reported exception to a service such as Sentry, override `report_exception()`. The handler calls it for every exception it reports by default, which includes all unhandled exceptions behind a `500` response:

```python
# bootstrap/application.py
import sentry_sdk

from fastapi_startkit.exceptions import ExceptionHandler as BaseHandler


class ExceptionHandler(BaseHandler):
    def report_exception(self, exception):
        sentry_sdk.capture_exception(exception)
        super().report_exception(exception)
```

Calling `super().report_exception()` keeps writing the exception to your log as well.

## Suppressing Reports

Some exceptions are part of normal operation and don't belong in your logs. Pass them to `dont_report()`:

```python
def register(self):
    self.dont_report([NotAuthenticated, InvoiceLocked])
```

Unlike renderers and reporters, `dont_report()` also covers subclasses of the classes you pass. The exceptions are still rendered as usual.

## Handler Objects

When an exception needs both custom reporting and rendering, register an object with a `report(exc)` method, an async `render(request, exc)` method, or both:

```python
from starlette.responses import JSONResponse


class PaymentGatewayHandler:
    def report(self, exc):
        sentry_sdk.capture_exception(exc)

    async def render(self, request, exc):
        return JSONResponse({"error": "Payment provider unavailable."}, status_code=503)


class ExceptionHandler(BaseHandler):
    def register(self):
        self.register_handler(PaymentGatewayError, PaymentGatewayHandler())
```

Handler objects match subclasses too, so a `CardDeclined(PaymentGatewayError)` exception also returns the `503` response. When several handlers could match, the one registered for the closest parent class wins.

`FastAPIProvider` registers its own handler objects for `Exception`, Starlette's `HTTPException`, `RequestValidationError` and `ValidationException` after your `register()` method runs, so a handler object you register for one of those four classes is replaced. Use `register_render()`, `register_report()` or `report_exception()` to change how they behave.

## Defining HTTP Exceptions

To give your own exception a status code, extend `HttpException` and implement `get_status()` and `get_response()`. Override `get_headers()` when the response needs headers:

```python
# app/exceptions.py
from fastapi_startkit.exceptions import HttpException


class OrderAlreadyShipped(HttpException):
    def get_status(self):
        return 409

    def get_response(self):
        return "This order has already shipped."
```

Raising `OrderAlreadyShipped()` from a route returns `{"detail": "This order has already shipped."}` with status `409`, without registering a renderer. Since the status is below `500`, the exception isn't reported.

## Built-In Exception Types

The framework raises these exceptions itself, and you can raise them from your own code. `ModelNotFoundException` is imported from `fastapi_startkit.masoniteorm`. The others are in `fastapi_startkit.exceptions`.

| Exception | Status | Raised by | Default message |
|---|---|---|---|
| `ModelNotFoundException` | 404 | `find_or_fail()` and `first_or_fail()` on a model | `User with primary key 7 not found.` or `User not found.`; `Model Not Found` when you raise it without a message |
| `RouteNotFoundException` | 404 | Your code | Takes a required message; `Route Not Found` when it is `None` or empty |
| `AuthorizationException` | 403 | A form request whose `authorize()` check fails | `This action is unauthorized.` from a form request; `Action not authorized` when you raise it without a message |
| `MethodNotAllowedException` | 405 | Your code | `<METHOD> method not allowed for this route. Supported methods are: <methods>.` |
| `ValidationException` | 422 | A form request whose rules fail | The validation messages |
| [`ThrottleRequestsException`](/docs/rate-limiting) | 429 | The `throttle()` dependency | `Too many attempts` |
| `HttpResponseException` | The wrapped response's status | Your code | The wrapped response |

`ThrottleRequestsException` returns a `429` response with the message `Too many attempts` and the `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers when a client exceeds a rate limit.

`HttpResponseException` wraps a ready-made response, which the handler returns unchanged:

```python
from starlette.responses import JSONResponse

from fastapi_startkit.exceptions import HttpResponseException

raise HttpResponseException(JSONResponse({"error": "Maintenance in progress."}, status_code=503))
```

Each HTTP exception has `get_status()`, `get_response()` and `get_headers()` methods, which you can use in a renderer to change the response format:

```python
from starlette.responses import JSONResponse

from fastapi_startkit.masoniteorm import ModelNotFoundException

def register(self):
    self.register_render(
        ModelNotFoundException,
        lambda request, exc: JSONResponse(
            {"error": exc.get_response()},
            status_code=exc.get_status(),
        ),
    )
```

## Exceptions in Console Commands

Exceptions raised by a console command, or anywhere else outside an HTTP request, are reported in the same way: your reporters, handler objects and `dont_report()` list all apply. Your renderers aren't called, because there's no HTTP response. The console still prints the error and the command exits with status `1`. Pressing `Ctrl+C` isn't reported.
