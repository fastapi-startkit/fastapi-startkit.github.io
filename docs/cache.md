---
outline: deep
title: Cache
description: Cache values in memory, files, a database table or Redis with the async Cache facade, including remember, memoization, atomic locks and tags.
keywords: cache, caching, remember, memoize, atomic locks, cache tags, redis cache, database cache, fastapi startkit
---

# Cache

Some work is slow or expensive to repeat on every request: a heavy query, a call to a third-party API, a rendered report. The cache lets you store the result once and read it back quickly on later requests. You configure named stores, and the `Cache` facade reads and writes the default one. Every cache operation is async.

## Installation

The cache ships with the core package. The `array` and `file` stores need nothing else. The `database` and `redis` stores need an extra:

| Store | Install |
|---|---|
| `array`, `file` | Nothing extra |
| `database` | `fastapi-startkit[database]` and a driver extra such as `sqlite` |
| `redis` | `fastapi-startkit[redis]` |

```bash
uv add "fastapi-startkit[database,sqlite]"
uv add "fastapi-startkit[redis]"
```

## Registering the Provider

Add `CacheProvider` to the providers in `bootstrap/application.py`. The `database` store also needs `DatabaseProvider`, and the `redis` store needs `RedisProvider`:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.cache import CacheProvider
from fastapi_startkit.masoniteorm.providers import DatabaseProvider
from fastapi_startkit.redis import RedisProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        DatabaseProvider,
        RedisProvider,
        CacheProvider,
    ],
)
```

## Configuration

The default store is `database`. If you're working locally without a database, switch to the `file` store in `.env`:

```ini
CACHE_CONNECTION=file
```

| Variable | Default | Sets |
|---|---|---|
| `CACHE_CONNECTION` | `database` | `default`, the store the facade uses |
| `CACHE_PREFIX` | `cache` | `prefix`, added to every key as `<prefix>:<key>` |
| `CACHE_FILE_PATH` | `storage/framework/cache/data` | `path` of the `file` store, relative to the application base path |
| `DB_CACHE_CONNECTION` | unset | `connection` of the `database` store; unset uses the default database connection |
| `DB_CACHE_TABLE` | `caches` | `table` of the `database` store |

### Publishing the Config

To change the stores, publish the config file and the cache table migration:

```bash
uv run python artisan provider:publish --provider=cache
```

This writes `config/cache.py` and `databases/migrations/2026_10_21_000000_create_caches_table.py`. The config looks like this:

```python
# config/cache.py
from dataclasses import dataclass, field

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env


@dataclass
class ArrayStoreConfig(Config):
    driver: str = "array"


@dataclass
class FileStoreConfig(Config):
    driver: str = "file"
    path: str = env("CACHE_FILE_PATH", "storage/framework/cache/data")


@dataclass
class DatabaseStoreConfig(Config):
    driver: str = "database"
    connection: str | None = env("DB_CACHE_CONNECTION", None, cast=False)
    table: str = env("DB_CACHE_TABLE", "caches")


@dataclass
class RedisStoreConfig(Config):
    driver: str = "redis"
    connection: str = "cache"


@dataclass
class CacheConfig(Config):
    default: str = env("CACHE_CONNECTION", "database")
    prefix: str = env("CACHE_PREFIX", "cache")
    stores: dict[str, Config] = field(
        default_factory=lambda: {
            "array": ArrayStoreConfig(),
            "file": FileStoreConfig(),
            "database": DatabaseStoreConfig(),
            "redis": RedisStoreConfig(),
        }
    )
```

Then pass the class to the provider:

```python
# bootstrap/application.py
from config.cache import CacheConfig

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        DatabaseProvider,
        RedisProvider,
        (CacheProvider, CacheConfig),
    ],
)
```

Your config replaces the defaults one top-level key at a time. If you define `stores`, list every store you need, because the default `stores` dict is replaced as a whole.

## Cache Stores

Each entry in `stores` names a `driver` and that driver's options. Several stores can use the same driver.

| Driver | Where values live |
|---|---|
| `array` | A dict in the current process. Values are lost on restart and aren't shared between workers, which makes it a good fit for tests. |
| `file` | One file per key under `path`. |
| `database` | A table on a database connection. |
| `redis` | A Redis connection. |

The `file`, `database` and `redis` stores serialize values with `pickle`, so the values you cache must be picklable. The `array` store keeps the object itself, so changing a value after you cache it changes the cached copy too.

::: warning
Because values are unpickled when they're read, never point a cache store at data that someone outside your application can write.
:::

### Database

The `database` store needs a table with a `key` primary key, a `value` text column and a nullable `expiration` integer. The published migration creates it, using the table name from `DB_CACHE_TABLE`:

```bash
uv run python artisan provider:publish --provider=cache
uv run python artisan db:migrate
```

Set `DB_CACHE_CONNECTION` to keep the cache on a different connection from your models. Expired rows are deleted when they're next read.

### Redis

The `redis` store sends commands through the Redis connection named in its `connection` option, `cache` by default. That connection's host, database and key prefix come from your [Redis](/docs/redis#configuration) config. Using the store without `RedisProvider` registered raises `RuntimeError`.

Keys are stored as `<redis prefix><cache prefix>:<key>`, and Redis expires entries with a TTL on its own. `flush()` deletes only the keys under the cache prefix, so other data in the same Redis database is kept. For that reason the `redis` store needs a non-empty `CACHE_PREFIX`.

## Cache Usage

Import the `Cache` facade:

```python
from fastapi_startkit.facades import Cache
```

Calls on the facade go to the default store. Every read and write is a coroutine, so await it.

### Storing Items

`put(key, value, ttl)` stores a value. The TTL is a number of seconds or a `timedelta`:

```python
from datetime import timedelta

await Cache.put("orders.count", 42, 600)
await Cache.put("orders.count", 42, timedelta(minutes=10))
```

Leave out the TTL, or call `forever()`, to keep the value until you remove it:

```python
await Cache.put("countries", countries)
await Cache.forever("countries", countries)
```

`put()` returns `True` when the value is stored. A TTL of zero or less removes the key and returns `False`.

### Retrieving Items

`get()` returns the cached value, or `None` when the key is missing or expired:

```python
count = await Cache.get("orders.count")
```

Pass a second argument to use as the default on a miss. The default can be a value, a function or a coroutine function:

```python
count = await Cache.get("orders.count", 0)
count = await Cache.get("orders.count", lambda: count_orders())
settings = await Cache.get("settings", load_settings)  # async def load_settings()
```

The default isn't stored. Use [`remember()`](#remember) when you want it stored.

### Checking for Items

`has()` tells you whether a key is present and not expired:

```python
if await Cache.has("orders.count"):
    ...
```

A cached `None` counts as present, so `None`, `0`, `False` and `""` are all values you can cache.

### Remember

`remember(key, ttl, factory)` returns the cached value when there is one. On a miss, it calls the factory, caches the result for `ttl`, and returns it. The factory can be sync or async:

```python
async def load_settings():
    return await Setting.where("active", True).get()


settings = await Cache.remember("settings", timedelta(hours=1), load_settings)
```

Pass `None` as the TTL to keep the result until it's removed:

```python
countries = await Cache.remember("countries", None, load_countries)
```

#### As a Decorator

Called without a factory, `remember()` returns a decorator. The decorated function becomes async, and each call is cached under the key plus a hash of its arguments, so different arguments get different entries:

```python
# app/services/profiles.py
from fastapi_startkit.facades import Cache


@Cache.remember("users.profile", 300)
async def profile(user_id: int):
    return await User.find(user_id)
```

```python
await profile(1)    # runs the query and caches the result
await profile(1)    # served from the cache
await profile(2)    # a separate entry
```

Pass `None` as the key to use the function's module and qualified name, such as `app.services.rates.exchange_rates`:

```python
@Cache.remember(None, 60)
def exchange_rates():
    return fetch_rates()
```

The decorator looks up the cache each time the function is called, so you can decorate module-level functions before the application boots.

### Removing Items

`forget()` removes one key and returns `True` if it existed. `flush()` empties the store:

```python
await Cache.forget("orders.count")
await Cache.flush()
```

On the `array`, `file` and `database` stores, `flush()` removes every entry in the store, whatever its prefix. Only the `redis` store limits it to the cache prefix.

### Using Multiple Stores

`Cache.store(name)` returns a named store with the same methods as the facade:

```python
await Cache.store("file").put("report", report, 3600)
report = await Cache.store("file").get("report")
```

Asking for a store that isn't in `stores` raises `ValueError`.

## Cache Memoization

When you read the same key several times while handling one request, `Cache.memo()` saves the repeat trips to the store. The first `get()` of a key reads the store, and later reads of that key return the remembered value:

```python
settings = await Cache.memo().get("settings")
settings = await Cache.memo().get("settings")   # not read from the store again

flags = await Cache.memo("redis").get("feature-flags")
```

Memoized values belong to the current asyncio task. Each FastAPI request runs in its own task, so requests never share a memo, and the memo is dropped when the task ends. Calling `put()`, `forget()` or `flush()` through the memo clears the remembered value and then writes to the store.

A memo doesn't see writes made through `Cache` directly, or by another process, after it has read a key. Use it for values that stay the same for the length of a request.

## Atomic Locks

A lock makes sure only one owner runs a piece of code at a time. With the `file`, `database` or `redis` store, the lock holds across processes that share the store. With the `array` store, it only holds within one process.

`Cache.lock(name, seconds)` creates a lock. `seconds` is how long the lock lasts before it expires on its own, and `0`, the default, means it never expires:

```python
lock = Cache.lock("reports.generate", 10)

if await lock.get():
    try:
        await generate_report()
    finally:
        await lock.release()
```

`get()` returns `True` when it acquires the lock and `False` when another owner holds it. Pass a callback, sync or async, and `get()` runs it, releases the lock, and returns the callback's result:

```python
report = await Cache.lock("reports.generate", 10).get(generate_report)
```

### Context Manager

You can also hold a lock with `async with`. It acquires the lock, or raises `LockTimeoutError` when another owner holds it, and releases it on exit:

```python
from fastapi_startkit.cache import LockTimeoutError

try:
    async with Cache.lock("reports.generate", 10):
        await generate_report()
except LockTimeoutError:
    ...
```

### Blocking Until Available

`block(seconds)` waits for the lock instead of giving up. It retries every 250 ms for up to `seconds`, then raises `LockTimeoutError`:

```python
lock = Cache.lock("reports.generate", 10)

await lock.block(5)
try:
    await generate_report()
finally:
    await lock.release()
```

Pass a callback to wait, run it, and release the lock in one call:

```python
await Cache.lock("reports.generate", 10).block(5, generate_report)
```

### Owners and Releasing

Each lock has an owner token, which is random unless you pass one. `release()` only releases the lock when this owner holds it, and returns `False` otherwise. To release a lock from somewhere else, such as a queued job, pass the token along and create the lock with it:

```python
lock = Cache.lock("orders.process", 120)

if await lock.get():
    await dispatch_processing(order_id, owner=lock.owner)
```

```python
# in the job that received the owner token
await Cache.lock("orders.process", 120, owner).release()
```

`force_release()` removes a lock whoever holds it:

```python
await Cache.lock("orders.process").force_release()
```

Locks aren't re-entrant, so a second `get()` by the same owner while the lock is held returns `False`. Take locks from `Cache` or `Cache.store(name)`; calling `lock()` on `Cache.memo()` or `Cache.tags()` raises `TypeError`.

## Cache Tags

Tags group related entries so you can flush them together. `Cache.tags(names)` returns a store whose entries belong to those tags:

```python
await Cache.tags(["people", "artists"]).put("John", john, 600)
await Cache.tags(["people", "authors"]).put("Anne", anne, 600)
```

To read an entry, use the same tags you stored it with. Order and duplicates don't matter, and a single tag can be a string:

```python
john = await Cache.tags(["artists", "people"]).get("John")
theme = await Cache.tags("settings").remember("theme", None, load_theme)
```

Flushing a tag invalidates every entry stored with that tag:

```python
await Cache.tags("authors").flush()   # removes Anne
await Cache.tags("people").flush()    # removes John too
```

Flushed entries can't be read any more, but they stay in the store until their TTL runs out or the store is flushed. Tags work with every built-in store. `Cache.tags([])` raises `ValueError`.

## Custom Stores

A store is any object with four async methods, where `get()` returns `MISSING` on a miss:

```python
# app/cache/null_store.py
from typing import Any

from fastapi_startkit.cache import MISSING


class NullStore:
    async def get(self, key: str) -> Any:
        return MISSING

    async def put(self, key: str, value: Any, seconds: float | None) -> bool:
        return True

    async def forget(self, key: str) -> bool:
        return False

    async def flush(self) -> bool:
        return True
```

Register a factory for a driver name with `Cache.extend()` in a provider's `boot()` method. The factory receives the store's config as a dict:

```python
# providers/null_cache_provider.py
from fastapi_startkit.facades import Cache
from fastapi_startkit.support import Provider

from app.cache.null_store import NullStore


class NullCacheProvider(Provider):
    def boot(self):
        Cache.extend("null", lambda config: NullStore())
```

Then add a store that uses the driver. A store can be a config class or a plain dict:

```python
# config/cache.py
@dataclass
class CacheConfig(Config):
    default: str = env("CACHE_CONNECTION", "file")
    stores: dict[str, Config | dict] = field(
        default_factory=lambda: {
            "array": ArrayStoreConfig(),
            "file": FileStoreConfig(),
            "null": {"driver": "null"},
        }
    )
```

To support locks, give the store a `lock(name, seconds, owner)` method that returns a subclass of `fastapi_startkit.cache.Lock` implementing `acquire()`, `release()` and `force_release()`.

See [Rate Limiting](/docs/rate-limiting) for counting attempts in a cache store.
