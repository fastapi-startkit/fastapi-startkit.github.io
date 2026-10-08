---
outline: deep
title: Redis
description: Use Redis from FastAPI Startkit with named connections, key prefixes, pipelines, transactions, pub/sub and Lua scripts — all async.
keywords: redis, cache, pipeline, transaction, pub/sub, redis.asyncio, fastapi startkit
---

# Redis

[Redis](https://redis.io) is an in-memory key-value store that is often used for caching, counters, locks and pub/sub messaging. FastAPI Startkit ships a Laravel-style Redis component built on [`redis.asyncio`](https://redis.readthedocs.io/en/stable/examples/asyncio_examples.html): named connections are defined in config, a `Redis` facade proxies commands to the default connection, and every call is awaitable.

## Installation

Redis support is an optional extra. It installs [redis-py](https://github.com/redis/redis-py) 5.0.1 or newer:

```bash
pip install "fastapi-startkit[redis]"
# or
uv add "fastapi-startkit[redis]"
```

The `redis` package is imported lazily, so importing `fastapi_startkit.redis`, the provider or the facade never fails. If the package is missing, the first attempt to resolve a connection raises `RedisNotInstalledError` (a subclass of `ImportError`) with the install hint.

## Registering the Provider

Add `RedisProvider` to your application's provider list in `bootstrap/application.py`:

```python
from fastapi_startkit import Application
from fastapi_startkit.redis import RedisProvider

app = Application(
    base_path=...,
    providers=[
        RedisProvider,
        # ... other providers
    ],
)
```

The provider:

- binds a `RedisManager` into the container under the `redis` key (this is what the `Redis` facade resolves),
- merges its configuration under the `redis` config key, so `config("redis.connections.default.host")` works,
- publishes `config/redis.py`,
- disconnects every open Redis connection when the FastAPI app shuts down (see [Shutdown and Lifespan](#shutdown-and-lifespan)).

## Configuration

### Publishing the Config

Publish the default config file into your project:

```bash
uv run python artisan provider:publish --provider=redis
```

This copies `config/redis.py` into your project:

```python
# config/redis.py
import re
from dataclasses import dataclass, field
from typing import Any

from fastapi_startkit.environment import env


def default_prefix() -> str:
    app_name = str(env("APP_NAME", "fastapi", cast=False))
    return re.sub(r"[^a-z0-9]+", "_", app_name.lower()).strip("_") + "_database_"


@dataclass
class RedisConfig:
    client: str = field(default_factory=lambda: env("REDIS_CLIENT", "redis"))

    options: dict[str, Any] = field(
        default_factory=lambda: {
            "prefix": env("REDIS_PREFIX", default_prefix(), cast=False),
        }
    )

    connections: dict[str, dict[str, Any]] = field(
        default_factory=lambda: {
            "default": {
                "url": env("REDIS_URL", None, cast=False),
                "host": env("REDIS_HOST", "127.0.0.1"),
                "username": env("REDIS_USERNAME", None, cast=False),
                "password": env("REDIS_PASSWORD", None, cast=False),
                "port": env("REDIS_PORT", 6379),
                "database": env("REDIS_DB", 0),
            },
            "cache": {
                "url": env("REDIS_URL", None, cast=False),
                "host": env("REDIS_HOST", "127.0.0.1"),
                "username": env("REDIS_USERNAME", None, cast=False),
                "password": env("REDIS_PASSWORD", None, cast=False),
                "port": env("REDIS_PORT", 6379),
                "database": env("REDIS_CACHE_DB", 1),
            },
        }
    )
```

Then pass your config class to the provider in `bootstrap/application.py`:

```python
from fastapi_startkit import Application
from fastapi_startkit.redis import RedisProvider
from config.redis import RedisConfig

app = Application(
    base_path=...,
    providers=[
        (RedisProvider, RedisConfig),
        # ... other providers
    ],
)
```

Your config is merged over the framework defaults one top-level key at a time: if you define `connections`, it replaces the default `connections` dict entirely, so list every connection you need.

### Environment Variables

| Variable | Default | Used by |
|---|---|---|
| `REDIS_CLIENT` | `redis` | `client` — the client factory to use |
| `REDIS_PREFIX` | `slug(APP_NAME, "_") + "_database_"` | `options.prefix` |
| `REDIS_URL` | — | `url` of both `default` and `cache` |
| `REDIS_HOST` | `127.0.0.1` | `host` of both connections |
| `REDIS_USERNAME` | — | `username` of both connections |
| `REDIS_PASSWORD` | — | `password` of both connections |
| `REDIS_PORT` | `6379` | `port` of both connections |
| `REDIS_DB` | `0` | `database` of the `default` connection |
| `REDIS_CACHE_DB` | `1` | `database` of the `cache` connection |

A minimal `.env`:

```ini
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=
REDIS_PORT=6379
```

### Key Prefix

Every key sent through a connection is prefixed with `options.prefix`, so several applications can share one Redis server without colliding. With `APP_NAME="My Shop"` the default prefix is `my_shop_database_`, and `await Redis.set("name", "taylor")` stores the key `my_shop_database_name`.

Set `REDIS_PREFIX` to choose your own prefix, or set it to an empty string to store keys exactly as given:

```ini
REDIS_PREFIX=shop:
```

redis-py has no native prefix option, so the framework prefixes key arguments itself using a per-command table of key positions. It covers single-key commands, multi-key commands (`DEL`, `MGET`, `SINTER`, ...), blocking pops (`BLPOP` and friends, where the trailing timeout is left alone), interleaved `MSET`/`MSETNX`, the `numkeys` keys of `EVAL`/`EVALSHA`, the stream keys after `STREAMS` in `XREAD`/`XREADGROUP`, and container commands such as `XGROUP CREATE`, `XINFO STREAM`, `OBJECT ENCODING` and `MEMORY USAGE`. Pipelines and transactions are prefixed the same way. Commands that are not in the table are sent unchanged — see [Known Limitations](#known-limitations).

### Connections

The config defines two named connections, `default` and `cache`, which use the same server but different databases. Add as many as you like under `connections`:

```python
connections: dict[str, dict[str, Any]] = field(
    default_factory=lambda: {
        "default": {
            "host": env("REDIS_HOST", "127.0.0.1"),
            "port": env("REDIS_PORT", 6379),
            "database": env("REDIS_DB", 0),
        },
        "sessions": {
            "host": env("REDIS_SESSIONS_HOST", "127.0.0.1"),
            "port": 6379,
            "database": 2,
            "options": {"prefix": "sessions:"},
            "socket_timeout": 5,
        },
    }
)
```

Each connection accepts:

- `url`, `host`, `port`, `username`, `password` — where and how to connect. Keys whose value is `None` are omitted.
- `database` — the database index (passed to redis-py as `db`).
- `options` — per-connection options merged over the global `options`; use it to give a connection its own `prefix`.
- Any other key is passed straight to [`redis.asyncio.Redis`](https://redis.readthedocs.io/en/stable/connections.html), e.g. `ssl`, `socket_timeout` or `max_connections`.

`decode_responses` defaults to `True`, so values come back as `str` rather than `bytes`. Set `"decode_responses": False` on a connection to work with raw bytes.

### URLs and Credentials

When a connection has a `url` (for example `REDIS_URL=redis://redis.internal:6379/0`), the client is built with `redis.asyncio.Redis.from_url()`:

- `host` and `port` are ignored — the URL decides where to connect.
- `username`, `password` and `database` still apply as fallbacks, so `REDIS_URL=redis://redis:6379` combined with `REDIS_PASSWORD=secret` authenticates with `secret`.
- Credentials or a database embedded in the URL win over the configured ones (`redis://:fromurl@cache.internal:6381` uses the password `fromurl` even if `REDIS_PASSWORD` is set).

TLS works the same way with a `rediss://` URL.

### Unix Sockets

To connect over a Unix domain socket, use a `unix://` URL:

```ini
REDIS_URL=unix:///var/run/redis/redis.sock
```

Because `host` and `port` are dropped whenever `url` is set, the socket connection does not receive TCP-only arguments, while `username`, `password` and `database` (`REDIS_DB`) are still applied.

## Interacting With Redis

Import the `Redis` facade anywhere in your application:

```python
from fastapi_startkit.facades import Redis
```

Any redis-py command called on the facade is proxied to the `default` connection. Every command is a coroutine, so await it:

```python
from fastapi_startkit.facades import Redis
from fastapi_startkit.fastapi import Router

router = Router()


async def show(user_id: int):
    return {"user": await Redis.get(f"user:profile:{user_id}")}


router.get("/users/{user_id}", show)
```

Method names and signatures are redis-py's, for example:

```python
await Redis.set("name", "Taylor", ex=60)
await Redis.get("name")                 # "Taylor"
await Redis.incr("visits")
await Redis.hset("user:1", mapping={"name": "Taylor", "role": "admin"})
await Redis.hgetall("user:1")           # {"name": "Taylor", "role": "admin"}
await Redis.rpush("queue", "a", "b")
await Redis.lrange("queue", 0, -1)      # ["a", "b"]
```

The facade ships with a `.pyi` stub that types it as a `redis.asyncio.Redis` subclass, so every redis-py command is type-checked and auto-completed in your IDE.

### Using Multiple Connections

`Redis.connection()` returns a `Connection` for a named connection; without a name it returns `default`. Connections are created on first use and cached, so repeated calls return the same client:

```python
await Redis.connection("cache").set("name", "Taylor")

connection = Redis.connection()          # the "default" connection
await connection.get("name")
```

Asking for a connection that is not configured raises `ValueError("Redis connection [name] not configured.")`.

### Running Raw Commands

`Redis.command()` sends a command exactly as Redis expects it, regardless of how redis-py names or shapes the method. Pass the command name and a list of arguments in protocol order:

```python
await Redis.command("set", ["name", "Taylor", "EX", 10])
await Redis.command("rpush", ["list", "a", "b", "c"])
await Redis.command("lrange", ["list", 0, -1])   # ["a", "b", "c"]
await Redis.command("ping")                      # True
```

The command name is upper-cased for you, and key arguments are prefixed like any other command.

### Pipelining Commands

Pipelining sends many commands in a single round trip. Pass a callback to `pipeline()` that queues commands on the pipeline; the commands are executed when the callback returns, and you get back the list of results. The callback may be a plain function or a coroutine function:

```python
def queue(pipe):
    for i in range(1000):
        pipe.set(f"key:{i}", i)

results = await Redis.pipeline(queue)    # [True, True, ...]
```

```python
async def queue(pipe):
    pipe.set("counter", 1)
    pipe.incr("counter")

await Redis.pipeline(queue)              # [True, 2]
```

Commands queued on a pipeline are **not** awaited — they are buffered until execution.

Call `pipeline()` without a callback to get the redis-py pipeline itself and drive it with `async with`:

```python
async with Redis.pipeline() as pipe:
    pipe.set("a", 1).set("b", 2)
    results = await pipe.execute()       # [True, True]
```

Both forms are non-transactional and apply the key prefix.

### Transactions

`transaction()` works like `pipeline()`, but wraps the queued commands in `MULTI` / `EXEC`, so they run atomically:

```python
await Redis.set("balance", 10)

results = await Redis.transaction(
    lambda multi: multi.decrby("balance", 3).incr("audit")
)
# [7, 1]
```

```python
async with Redis.transaction() as multi:
    multi.incr("visits").incr("visits")
    results = await multi.execute()      # [1, 2]
```

::: warning
As in Laravel, you cannot read values inside a transaction: commands are only queued, and their results are returned together once the transaction executes.
:::

### Lua Scripts

`eval()` is redis-py's `eval(script, numkeys, *keys_and_args)`. The first `numkeys` arguments after the script are keys (and are prefixed); the rest are passed as `ARGV`:

```python
await Redis.set("name", "taylor")

result = await Redis.eval(
    "return redis.call('get', KEYS[1]) .. ARGV[1]",
    1,
    "name",
    "!",
)
# "taylor!"
```

`evalsha()` follows the same key rule.

## Pub / Sub

Redis can publish messages to channels and let listeners subscribe to them. Publishing is a regular command:

```python
await Redis.publish("orders", "created")   # number of subscribers that received it
```

`subscribe()` subscribes to one channel or a list of channels and calls `callback(message, channel)` for every message. The callback may be sync or async. `subscribe()` keeps listening until its task is cancelled, so run it as a background task — for example in a long-running console command or worker:

```python
import asyncio

from fastapi_startkit.facades import Redis


async def handle(message, channel):
    print(f"{channel}: {message}")


listener = asyncio.create_task(Redis.subscribe(["orders", "invoices"], handle))

# ... later, to stop listening
listener.cancel()
```

Subscription confirmation messages are skipped, and the underlying `PubSub` is closed when the task is cancelled.

### Wildcard Subscriptions

`psubscribe()` subscribes to channel patterns. The callback receives the channel the message was actually published on:

```python
async def handle(message, channel):
    print(f"{channel}: {message}")    # e.g. "users.1: updated"


listener = asyncio.create_task(Redis.psubscribe("users.*", handle))

await Redis.publish("users.1", "updated")
```

Channel names and patterns are **not** prefixed.

## Managing Connections

### Custom Clients

`Redis.extend(client, factory)` registers a client factory under a name, like Laravel's `Redis::extend`. The factory receives the connection parameters (`host`, `port`, `db`, `decode_responses`, ...) and returns a `redis.asyncio`-compatible client. Select it with `client` in config (`REDIS_CLIENT`):

```python
import fakeredis

from fastapi_startkit.facades import Redis

server = fakeredis.FakeServer()
Redis.extend("fake", lambda parameters: fakeredis.FakeAsyncRedis(server=server, **parameters))
```

```ini
# .env.testing
REDIS_CLIENT=fake
```

This is how the framework's own test suite runs against [fakeredis](https://github.com/cunla/fakeredis-py). Selecting a client name that was never registered raises `ValueError("Redis client [name] is not supported.")`. `extend()` returns the manager, so calls can be chained.

### Purging and Disconnecting

```python
Redis.connections()            # {"default": <Connection>, ...} — currently open connections

await Redis.purge()            # close and forget the "default" connection
await Redis.purge("cache")     # close and forget a named connection
await Redis.disconnect()       # close and forget every connection
```

A purged connection is recreated on its next use. Purging a connection that is not open is a no-op.

## Shutdown and Lifespan

When FastAPI is available, `RedisProvider` wraps the FastAPI router's `lifespan_context` so that `await Redis.disconnect()` runs when the application shuts down. Because it wraps the lifespan instead of registering a `shutdown` event handler, it also works when you pass your own `lifespan=` to FastAPI — your startup and shutdown code still run, and the state your lifespan yields is preserved.

The wrap applies to the FastAPI instance and lifespan present when the provider boots. If your application replaces either after boot, disconnect Redis yourself in your own lifespan:

```python
from contextlib import asynccontextmanager

from fastapi_startkit.facades import Redis


@asynccontextmanager
async def lifespan(app):
    yield
    await Redis.disconnect()
```

Outside of FastAPI (for example in console commands), call `await Redis.disconnect()` when you are done.

## Differences From Laravel

- **Connections are nested under `connections`.** Laravel puts named connections next to `client` and `options` in `database.redis`; Python dataclasses cannot hold arbitrary sibling keys, so they live under `connections` (as `DatabaseConfig` does).
- **Everything is async.** Every command, `command()`, `pipeline(callback)`, `transaction(callback)`, `subscribe()`, `psubscribe()`, `purge()` and `disconnect()` must be awaited.
- **Method signatures are redis-py's**, not phpredis/Predis's (e.g. `set("k", "v", ex=60)`, `hset("h", mapping={...})`). Use `command()` when you want Redis-protocol arguments.
- **Prefixing is explicit.** The prefix is applied only to commands in the framework's key-position table; unknown commands and pub/sub channels are sent unprefixed rather than guessing key positions.
- **No Redis Cluster.** `clusters` and `options.cluster` are not supported yet.
- **Unknown connections** raise `ValueError` instead of `InvalidArgumentException`.

## Known Limitations

- Keys embedded in command options are not prefixed: `SORT ... STORE / BY / GET`, `GEORADIUS` / `GEORADIUSBYMEMBER ... STORE / STOREDIST`, and `MIGRATE ... KEYS`.
- Results are never un-prefixed. `keys()`, `scan()` / `scan_iter()` and stream names in `XREAD` replies come back **with** the prefix, and passing them back into another command prefixes them a second time (the same behaviour as phpredis). Strip the prefix (`Redis.connection().prefix`) before reusing them.
- The `keys()` pattern is prefixed (`await Redis.keys("user:*")` matches `<prefix>user:*`), but `scan(match=...)` / `scan_iter(match=...)` patterns are not — include the prefix in the pattern yourself.
- Commands missing from the key-position table are sent as-is.
- Redis Cluster is not supported.
