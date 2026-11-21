---
outline: deep
title: Rate Limiting
description: Limit how often a route or an action can run in FastAPI Startkit with named rate limiters, the throttle dependency and the async RateLimiter facade.
keywords: rate limiting, throttle, 429, too many requests, retry-after, x-ratelimit, rate limiter, fastapi startkit
---

# Rate Limiting

The rate limiter counts how many times something has happened within a window of time and tells you when the count goes over a limit. You can use it to throttle requests to a route, or call it directly to limit any action, such as sending a message or retrying a login.

Counts are kept in one of your [cache](/docs/cache) stores, so every worker that shares the store shares the same limits.

- [Configuration](#configuration)
- [Defining Rate Limiters](#defining-rate-limiters)
- [Attaching Rate Limiters to Routes](#attaching-rate-limiters-to-routes)
- [Manually Interacting With the Rate Limiter](#manually-interacting-with-the-rate-limiter)

## Configuration

Add `RateLimiterProvider` to the providers in `bootstrap/application.py`. Register `CacheProvider` too, so the limiter can keep its counts in a shared cache store:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.cache import CacheProvider
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.rate_limiting import RateLimiterProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        FastAPIProvider,
        CacheProvider,
        RateLimiterProvider,
    ],
)
```

The `RateLimiter` facade resolves the limiter the provider binds.

### Choosing the Cache Store

By default, the limiter uses your cache's default store. To keep rate limit counts in a different store, set `RATE_LIMITER_STORE` to the name of a store in `config/cache.py`:

```ini
RATE_LIMITER_STORE=redis
```

Use a store that every worker shares, such as `redis` or `database`. The `array` store lives in one process, so each worker would count on its own.

If you register `RateLimiterProvider` without `CacheProvider`, the limiter counts in a private in-memory store. Setting `RATE_LIMITER_STORE` without `CacheProvider` raises a `RuntimeError` the first time the limiter is used.

To edit the config in your project, publish it to `config/rate_limiter.py`:

```bash
uv run python artisan provider:publish --provider=rate_limiter
```

::: warning
If you use the `database` cache store on SQLite, point it at a database file. An in-memory SQLite database shares one connection between requests and is not safe for concurrent writes.
:::

## Defining Rate Limiters

A rate limiter is a named callback that receives the current request and returns a `Limit`. Define your limiters in the `boot()` method of one of your application's providers:

```python
# app/providers/app_provider.py
from fastapi_startkit.facades import RateLimiter
from fastapi_startkit.rate_limiting import Limit
from fastapi_startkit.support import Provider


class AppProvider(Provider):
    def boot(self) -> None:
        RateLimiter.for_("global", lambda request: Limit.per_minute(1000))
```

The method is named `for_` because `for` is a Python keyword. The callback may be a regular function or an `async` function.

A `Limit` is built with one of these constructors:

| Constructor | Allows |
|---|---|
| `Limit.per_second(max_attempts, decay_seconds=1)` | `max_attempts` every `decay_seconds` seconds |
| `Limit.per_minute(max_attempts, decay_minutes=1)` | `max_attempts` every `decay_minutes` minutes |
| `Limit.per_minutes(decay_minutes, max_attempts)` | `max_attempts` every `decay_minutes` minutes |
| `Limit.per_hour(max_attempts, decay_hours=1)` | `max_attempts` every `decay_hours` hours |
| `Limit.per_day(max_attempts, decay_days=1)` | `max_attempts` every `decay_days` days |
| `Limit.none()` | Any number of requests |

For example, `Limit.per_minutes(5, 100)` allows 100 requests every five minutes.

Because the callback receives the request, you can return a different limit depending on who is calling:

```python
RateLimiter.for_(
    "reports",
    lambda request: Limit.none() if request.headers.get("x-admin") else Limit.per_hour(10),
)
```

### Segmenting Rate Limits

Without a key, every request through a limiter shares one counter. Call `by()` to give each user, IP address or other value its own counter:

```python
RateLimiter.for_("uploads", lambda request: Limit.per_minute(10).by(request.client.host))
```

Here each client IP address can upload 10 times a minute. `by()` accepts any value and converts it to a string.

### Multiple Rate Limits

A callback can return a list of limits. A request must pass every limit in the list, and a rejected request is not counted against any of them:

```python
async def login(request: Request) -> list[Limit]:
    form = await request.form()
    return [
        Limit.per_minute(500),
        Limit.per_minute(3).by(form.get("email")),
    ]


RateLimiter.for_("login", login)
```

This allows 500 login attempts a minute across the application, and three a minute for each email address.

Limits in one list that have the same window and the same `by()` key share a counter, so give each one a unique key or a different window.

### Custom Responses

When a request is limited, the framework returns a 429 response. To send your own response instead, pass a callback to `response()`. It receives the request and the rate limit headers, and returns a response:

```python
from fastapi.responses import JSONResponse

RateLimiter.for_(
    "uploads",
    lambda request: Limit.per_minute(10)
    .by(request.client.host)
    .response(
        lambda request, headers: JSONResponse(
            {"message": "Upload limit reached."}, status_code=429, headers=headers
        )
    ),
)
```

The response callback may also be an `async` function.

## Attaching Rate Limiters to Routes

Attach a limiter to a route or a router by adding the `throttle()` dependency with the limiter's name:

```python
# routes/api.py
from fastapi import Depends

from fastapi_startkit.fastapi import Router
from fastapi_startkit.rate_limiting import throttle

from app.http.controllers import posts_controller, uploads_controller

api = Router(dependencies=[Depends(throttle("global"))])
api.get("/posts", posts_controller.index)

uploads = Router(dependencies=[Depends(throttle("uploads"))])
uploads.post("/uploads", uploads_controller.store)
```

Routes that use the same limiter name share its counters. To count a group of routes separately, pass a `prefix`, for example `throttle("uploads", prefix="images")`.

Using a name that was never defined with `for_` raises `LimiterNotDefinedException` when the route is called.

### Throttling Without a Named Limiter

Call `throttle()` without a name to limit each client IP address directly. It allows 60 requests a minute by default:

```python
api = Router(dependencies=[Depends(throttle(max_attempts=30, decay_minutes=1))])
```

### Rate Limit Headers

Every request that passes a limiter gets two headers on its response:

| Header | Value |
|---|---|
| `X-RateLimit-Limit` | The maximum number of attempts in the window |
| `X-RateLimit-Remaining` | How many attempts are left in the window |

When the limiter returns several limits, the headers describe the last limit in the list.

When a request is over the limit, the route does not run. The response has status 429, the body `{"detail": "Too many attempts"}`, and these headers:

| Header | Value |
|---|---|
| `Retry-After` | Seconds until the window resets |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `X-RateLimit-Limit` | The maximum number of attempts in the window |
| `X-RateLimit-Remaining` | `0` |

For example, with `Limit.per_minute(3).by(request.client.host)`, the fourth request in a minute is rejected:

```python
from fastapi.testclient import TestClient

client = TestClient(app.fastapi)

for _ in range(4):
    response = client.get("/posts")
    print(response.status_code, response.headers.get("X-RateLimit-Remaining"))

# 200 2
# 200 1
# 200 0
# 429 0

print(response.headers["Retry-After"])  # 60
print(response.json())                  # {'detail': 'Too many attempts'}
```

A custom `response()` callback receives the same four headers, and you decide whether to send them.

## Manually Interacting With the Rate Limiter

You can also call the `RateLimiter` facade directly with a key of your choice. Every method is async.

### Attempting an Action

`attempt()` runs a callback unless the key has used up its attempts. It takes the key, the maximum number of attempts, the callback and the window length in seconds (60 by default):

```python
from fastapi_startkit.facades import RateLimiter

executed = await RateLimiter.attempt(
    f"send-message:{user.id}",
    5,
    lambda: send_message(user),
    decay_seconds=60,
)

if not executed:
    return {"message": "Too many messages sent!"}
```

When the limit is reached, `attempt()` returns `False` without running the callback. Otherwise it returns the callback's result, or `True` if the callback returned nothing. The callback may be an `async` function.

### Checking and Hitting Keys

To manage the count yourself, check it with `too_many_attempts()` and record an attempt with `hit()`:

```python
key = f"send-message:{user.id}"

if await RateLimiter.too_many_attempts(key, 5):
    seconds = await RateLimiter.available_in(key)
    return {"message": f"You may try again in {seconds} seconds."}

await RateLimiter.hit(key)

await send_message(user)
```

`hit()` returns the new count. It uses a 60 second window unless you pass another, for example `await RateLimiter.hit(key, decay_seconds=3600)`. `increment(key, decay_seconds=60, amount=1)` and `decrement()` change the count by more than one.

Use `remaining()` to see how many attempts a key has left:

```python
if await RateLimiter.remaining(f"send-message:{user.id}", 5):
    await RateLimiter.hit(f"send-message:{user.id}")
    await send_message(user)
```

These methods are also available:

| Method | Returns |
|---|---|
| `attempts(key)` | The number of attempts in the current window |
| `available_in(key)` | Seconds until the window resets, or `0` when no window is open |
| `retries_left(key, max_attempts)` | The same as `remaining()` |

### Clearing Attempts

`clear()` removes a key's count and its window, so the next attempt starts fresh. For example, you might clear the count after a message is read:

```python
await RateLimiter.clear(f"send-message:{user.id}")
```

`reset_attempts(key)` sets the count back to zero but keeps the current window open.

See [Cache](/docs/cache) to configure the stores the limiter writes to.
