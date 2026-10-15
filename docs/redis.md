---
outline: deep
title: Redis
description: Use Redis from FastAPI Startkit with named connections, key prefixes, pipelines, transactions, pub/sub and Lua scripts — all async.
keywords: redis, cache, pipeline, transaction, pub/sub, redis.asyncio, fastapi startkit
---

# Redis

[Redis](https://redis.io) is an in-memory key-value store, often used for caching, counters, locks, and pub/sub. The Redis component is built on [`redis.asyncio`](https://redis.readthedocs.io/en/stable/examples/asyncio_examples.html). You define named connections in config, and the `Redis` facade sends commands to the default connection. Every call is awaitable.

## Installation

Install the `redis` extra. It pulls in [redis-py](https://github.com/redis/redis-py) 5.0.1 or newer:

```bash
pip install "fastapi-startkit[redis]"
# or
uv add "fastapi-startkit[redis]"
```

`redis` is imported lazily, so importing `fastapi_startkit.redis`, the provider, or the facade works without it. If the package is missing, resolving a connection raises `RedisNotInstalledError`, a subclass of `ImportError` whose message tells you what to install.

## Registering the Provider

Add `RedisProvider` to the providers in `bootstrap/application.py`:

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

The provider binds a `RedisManager` under the `redis` key, which the `Redis` facade resolves. It merges its settings under the `redis` config key, so `config("redis.connections.default.host")` works. It can publish `config/redis.py`, and it disconnects every open connection when the FastAPI app shuts down (see [Shutdown and Lifespan](#shutdown-and-lifespan)).

## Configuration

### Publishing the Config

Copy the default config into your project:

```bash
uv run python artisan provider:publish --provider=redis
```

This writes `config/redis.py`:

```python
# config/redis.py
import os
import re
from dataclasses import dataclass, field

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env


def default_prefix() -> str:
    app_name = os.getenv("APP_NAME") or "fastapi"
    return re.sub(r"[^a-z0-9]+", "_", app_name.lower()).strip("_") + "_database_"


@dataclass
class RedisOptions(Config):
    prefix: str = field(default_factory=lambda: os.getenv("REDIS_PREFIX") or default_prefix())


@dataclass
class RedisConnectionConfig(Config):
    url: str | None = env("REDIS_URL", None, cast=False)
    host: str = env("REDIS_HOST", "127.0.0.1")
    username: str | None = env("REDIS_USERNAME", None, cast=False)
    password: str | None = env("REDIS_PASSWORD", None, cast=False)
    port: int = env("REDIS_PORT", 6379)
    database: int = env("REDIS_DB", 0)


@dataclass
class RedisConfig(Config):
    client: str = env("REDIS_CLIENT", "redis")

    options: RedisOptions = field(default_factory=RedisOptions)

    connections: dict[str, RedisConnectionConfig] = field(
        default_factory=lambda: {
            "default": RedisConnectionConfig(),
            "cache": RedisConnectionConfig(database=env("REDIS_CACHE_DB", 1)),
        }
    )
```

Pass your config class to the provider:

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

Your config is merged over the framework defaults one top-level key at a time. If you define `connections`, it replaces the whole default `connections` dict, so list every connection you need.

### Environment Variables

| Variable | Default | Used by |
|---|---|---|
| `REDIS_CLIENT` | `redis` | `client`, the client factory to use |
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

Each connection adds `options.prefix` to the front of every key it sends, so several applications can share one Redis server. With `APP_NAME="My Shop"` the default prefix is `my_shop_database_`, and `await Redis.set("name", "taylor")` stores the key `my_shop_database_name`.

Set `REDIS_PREFIX` to use your own prefix:

```ini
REDIS_PREFIX=shop:
```

An empty `REDIS_PREFIX` falls back to the default prefix. To store keys exactly as given, set the prefix to an empty string in config:

```python
@dataclass
class RedisConfig(Config):
    options: RedisOptions = field(default_factory=lambda: RedisOptions(prefix=""))
```

redis-py has no prefix option, so the framework prefixes key arguments itself, using a table of key positions for each command. The table covers:

- single-key and multi-key commands (`DEL`, `MGET`, `SINTER`, ...)
- blocking pops such as `BLPOP`, leaving the trailing timeout alone
- the interleaved keys of `MSET` and `MSETNX`
- the `numkeys` keys of `EVAL` and `EVALSHA`
- the stream keys after `STREAMS` in `XREAD` and `XREADGROUP`
- container commands such as `XGROUP CREATE`, `XINFO STREAM`, `OBJECT ENCODING`, and `MEMORY USAGE`

Pipelines and transactions are prefixed the same way. Commands missing from the table are sent unchanged. See [Known Limitations](#known-limitations).

### Connections

The default config has two connections, `default` and `cache`. They point at the same server and use different databases. Add more under `connections`. A connection can be a `RedisConnectionConfig` or a plain dict:

```python
@dataclass
class RedisConfig(Config):
    connections: dict[str, RedisConnectionConfig | dict] = field(
        default_factory=lambda: {
            "default": RedisConnectionConfig(),
            "sessions": {
                "host": "127.0.0.1",
                "port": 6379,
                "database": 2,
                "options": {"prefix": "sessions:"},
                "socket_timeout": 5,
            },
        }
    )
```

`env()` returns a dataclass field default, so use it only in a field declaration or as an argument to a `Config` class such as `RedisConnectionConfig(database=env("REDIS_CACHE_DB", 1))`. A plain dict keeps the field object instead of the value. In a dict, use `os.getenv()` or a literal.

Each connection accepts:

| Key | Meaning |
|---|---|
| `url`, `host`, `port`, `username`, `password` | Where and how to connect. Keys set to `None` are left out. |
| `database` | The database index, passed to redis-py as `db`. |
| `options` | Merged over the global `options`. Use it to give one connection its own `prefix`. |
| anything else | Passed to [`redis.asyncio.Redis`](https://redis.readthedocs.io/en/stable/connections.html), for example `ssl`, `socket_timeout`, or `max_connections`. |

`decode_responses` defaults to `True`, so values come back as `str`, not `bytes`. Set `"decode_responses": False` on a connection to get raw bytes.

### URLs and Credentials

When a connection has a `url`, such as `REDIS_URL=redis://redis.internal:6379/0`, the client is built with `redis.asyncio.Redis.from_url()`:

- `host` and `port` are ignored. The URL decides where to connect.
- `username`, `password`, and `database` are used as fallbacks. `REDIS_URL=redis://redis:6379` with `REDIS_PASSWORD=secret` authenticates with `secret`.
- Credentials or a database in the URL take precedence. `redis://:fromurl@cache.internal:6381` uses the password `fromurl` even when `REDIS_PASSWORD` is set.

For TLS, use a `rediss://` URL.

### Unix Sockets

Connect over a Unix domain socket with a `unix://` URL:

```ini
REDIS_URL=unix:///var/run/redis/redis.sock
```

`host` and `port` are dropped whenever `url` is set, so the socket connection gets no TCP-only arguments. `username`, `password`, and `database` (`REDIS_DB`) still apply.

## Interacting With Redis

Import the `Redis` facade:

```python
from fastapi_startkit.facades import Redis
```

Calling a redis-py command on the facade runs it on the `default` connection. Every command is a coroutine, so await it:

```python
from fastapi_startkit.facades import Redis
from fastapi_startkit.fastapi import Router

router = Router()


async def show(user_id: int):
    return {"user": await Redis.get(f"user:profile:{user_id}")}


router.get("/users/{user_id}", show)
```

Method names and signatures are the ones redis-py uses:

```python
await Redis.set("name", "Taylor", ex=60)
await Redis.get("name")                 # "Taylor"
await Redis.incr("visits")
await Redis.hset("user:1", mapping={"name": "Taylor", "role": "admin"})
await Redis.hgetall("user:1")           # {"name": "Taylor", "role": "admin"}
await Redis.rpush("queue", "a", "b")
await Redis.lrange("queue", 0, -1)      # ["a", "b"]
```

The facade's `.pyi` stub types it as a `redis.asyncio.Redis` subclass, so your IDE type-checks and completes redis-py commands.

### Using Multiple Connections

`Redis.connection(name)` returns the `Connection` with that name, or `default` when you pass no name. A connection is created on first use and cached:

```python
await Redis.connection("cache").set("name", "Taylor")

connection = Redis.connection()
await connection.get("name")
```

An unknown name raises `ValueError("Redis connection [name] not configured.")`.

### Running Raw Commands

`Redis.command()` sends a command in Redis protocol form, whatever redis-py calls the method. Pass the command name and a list of arguments in protocol order:

```python
await Redis.command("set", ["name", "Taylor", "EX", 10])
await Redis.command("rpush", ["list", "a", "b", "c"])
await Redis.command("lrange", ["list", 0, -1])   # ["a", "b", "c"]
await Redis.command("ping")                      # True
```

The command name is upper-cased, and key arguments are prefixed as usual.

### Pipelining Commands

A pipeline sends many commands in one round trip. Pass `pipeline()` a callback that queues commands. They run when the callback returns, and you get a list of results. The callback can be a plain function or a coroutine function:

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

Don't await commands on a pipeline. They are buffered until it executes.

Without a callback, `pipeline()` returns the redis-py pipeline for use with `async with`:

```python
async with Redis.pipeline() as pipe:
    pipe.set("a", 1).set("b", 2)
    results = await pipe.execute()       # [True, True]
```

Neither form is transactional. Both apply the key prefix.

### Transactions

`transaction()` works like `pipeline()` but wraps the queued commands in `MULTI` / `EXEC`, so they run atomically:

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
As in Laravel, you can't read values inside a transaction. Commands are only queued, and all results come back when the transaction executes.
:::

### Lua Scripts

`eval()` is redis-py's `eval(script, numkeys, *keys_and_args)`. The first `numkeys` arguments after the script are keys and get prefixed. The rest are passed as `ARGV`:

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

`evalsha()` treats keys the same way.

## Pub / Sub

Publish a message with a regular command. It returns the number of subscribers that received it:

```python
await Redis.publish("orders", "created")
```

`subscribe()` listens on one channel or a list of channels and calls `callback(message, channel)` for each message. The callback can be sync or async. `subscribe()` runs until its task is cancelled, so start it as a background task, for example in a long-running console command or worker:

```python
import asyncio

from fastapi_startkit.facades import Redis


async def handle(message, channel):
    print(f"{channel}: {message}")


listener = asyncio.create_task(Redis.subscribe(["orders", "invoices"], handle))

listener.cancel()
```

Subscription confirmations are skipped. Cancelling the task closes the underlying `PubSub`.

### Wildcard Subscriptions

`psubscribe()` subscribes to channel patterns. The callback receives the channel the message was published on:

```python
async def handle(message, channel):
    print(f"{channel}: {message}")    # "users.1: updated"


listener = asyncio.create_task(Redis.psubscribe("users.*", handle))

await Redis.publish("users.1", "updated")
```

Channel names and patterns are not prefixed.

## Managing Connections

### Custom Clients

`Redis.extend(client, factory)` registers a client factory under a name, like Laravel's `Redis::extend`. The factory receives the connection parameters (`host`, `port`, `db`, `decode_responses`, ...) and returns a client compatible with `redis.asyncio`. Choose it with `client` in config (`REDIS_CLIENT`):

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

The framework's own tests use this to run against [fakeredis](https://github.com/cunla/fakeredis-py). A client name that was never registered raises `ValueError("Redis client [name] is not supported.")`. `extend()` returns the manager, so you can chain calls.

### Purging and Disconnecting

```python
Redis.connections()            # the open connections, {"default": <Connection>, ...}

await Redis.purge()            # close and forget the "default" connection
await Redis.purge("cache")     # close and forget a named connection
await Redis.disconnect()       # close and forget every connection
```

A purged connection is created again the next time you use it. Purging a connection that isn't open does nothing.

## Shutdown and Lifespan

When FastAPI is installed, `RedisProvider` wraps the router's `lifespan_context` so that `await Redis.disconnect()` runs at shutdown. It wraps the lifespan instead of adding a `shutdown` handler, so it works with your own `lifespan=` as well. Your startup and shutdown code still run, and the state your lifespan yields is kept.

The wrap applies to the FastAPI instance and lifespan that exist when the provider boots. If your application replaces either one later, disconnect Redis in your own lifespan:

```python
from contextlib import asynccontextmanager

from fastapi_startkit.facades import Redis


@asynccontextmanager
async def lifespan(app):
    yield
    await Redis.disconnect()
```

Outside FastAPI, for example in console commands, call `await Redis.disconnect()` when you finish.

## Differences From Laravel

- Connections are nested under `connections`. Laravel puts named connections next to `client` and `options` in `database.redis`. A Python dataclass can't hold arbitrary sibling keys, so they live under `connections`, as in `DatabaseConfig`.
- Everything is async. Await every command, as well as `command()`, `pipeline(callback)`, `transaction(callback)`, `subscribe()`, `psubscribe()`, `purge()`, and `disconnect()`.
- Method signatures follow redis-py, not phpredis or Predis: `set("k", "v", ex=60)`, `hset("h", mapping={...})`. Use `command()` for Redis protocol arguments.
- Only commands in the key-position table are prefixed. Unknown commands and pub/sub channels are sent without a prefix.
- Redis Cluster is not supported. `clusters` and `options.cluster` don't exist yet.
- An unknown connection raises `ValueError`, not `InvalidArgumentException`.

## Known Limitations

- Keys inside command options are not prefixed: `SORT ... STORE / BY / GET`, `GEORADIUS` / `GEORADIUSBYMEMBER ... STORE / STOREDIST`, and `MIGRATE ... KEYS`.
- Results keep the prefix. `keys()`, `scan()` / `scan_iter()`, and stream names in `XREAD` replies come back prefixed, and passing them to another command prefixes them again, as phpredis does. Strip the prefix (`Redis.connection().prefix`) before you reuse them.
- The `keys()` pattern is prefixed, so `await Redis.keys("user:*")` matches `<prefix>user:*`. `scan(match=...)` and `scan_iter(match=...)` patterns are not, so include the prefix yourself.
- Commands missing from the key-position table are sent as-is.
- Redis Cluster is not supported.
