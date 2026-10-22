---
outline: deep
title: Cache
description: Cache values in memory, files, a database table or Redis with the async Cache facade — remember, memo, atomic locks and tags.
keywords: cache, caching, remember, memoize, atomic locks, cache tags, redis cache, database cache, fastapi startkit
---

# Cache

Some work is slow or expensive: a heavy query, a call to a third-party API, a rendered report. The cache stores the result so later requests read it back quickly. FastAPI Startkit's cache is modelled on Laravel's: you configure named stores, and the `Cache` facade reads and writes the default one. Every operation is async.

## Installation

The cache ships with the core package. Two of its stores need an extra:

| Store | Extra |
|---|---|
| `array`, `file` | none |
| `database` | `fastapi-startkit[database]` |
| `redis` | `fastapi-startkit[redis]` |

```bash
uv add "fastapi-startkit[database]"
# or, for the redis store
uv add "fastapi-startkit[redis]"
```

## Registering the Provider

Add `CacheProvider` to the providers in `bootstrap/application.py`:

```python
from fastapi_startkit import Application
from fastapi_startkit.cache import CacheProvider

app = Application(
    base_path=...,
    providers=[
        CacheProvider,
        # ... other providers
    ],
)
```

The provider binds a `CacheManager` under the `cache` key, which the `Cache` facade resolves. Its settings are merged under the `cache` config key, so `config("cache.default")` works.

The `database` store needs `DatabaseProvider`, and the `redis` store needs `RedisProvider`. Register those too if you use them.

## Configuration

### Publishing the Config

Copy the default config and the cache table migration into your project:

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

Pass your config class to the provider:

```python
from fastapi_startkit import Application
from fastapi_startkit.cache import CacheProvider
from config.cache import CacheConfig

app = Application(
    base_path=...,
    providers=[
        (CacheProvider, CacheConfig),
        # ... other providers
    ],
)
```

Your config is merged over the framework defaults one top-level key at a time. If you define `stores`, it replaces the whole default `stores` dict, so list every store you need.

### Environment Variables

| Variable | Default | Used by |
|---|---|---|
| `CACHE_CONNECTION` | `database` | `default`, the store the facade uses |
| `CACHE_PREFIX` | `cache` | `prefix`, added to every key as `<prefix>:<key>` |
| `CACHE_FILE_PATH` | `storage/framework/cache/data` | `path` of the `file` store, relative to the application base path |
| `DB_CACHE_CONNECTION` | — | `connection` of the `database` store; unset means the default database connection |
| `DB_CACHE_TABLE` | `caches` | `table` of the `database` store |

The default store is `database`. For local development without a database, switch to the file store:

```ini
CACHE_CONNECTION=file
```

## Cache Stores

Each entry in `stores` has a `driver` and the driver's own options. Several stores can use the same driver.

| Driver | Where values live | Notes |
|---|---|---|
| `array` | A dict in the current process | Lost on restart and not shared between workers. Good for tests. |
| `file` | One pickled file per key under `path` | Files are sharded by the SHA-1 of the key and written atomically. |
| `database` | A table on a database connection | Needs the `caches` table. |
| `redis` | A Redis connection from `config/redis.py` | Uses the `cache` connection by default. |

The `file`, `database` and `redis` stores serialize values with `pickle`, so values must be picklable. Only cache data your application produced. The `array` store keeps the object itself, so mutating a value after you cache it changes the cached copy too.

### Database

The `database` store needs a table with a `key` primary key, a `value` text column and a nullable `expiration` integer. The published migration creates it, using the table name from `cache.stores.database.table`:

```bash
uv run python artisan provider:publish --provider=cache
uv run python artisan db:migrate
```

Set `DB_CACHE_CONNECTION` to keep the cache on a different connection from your models. Expired rows are deleted when they are next read.

### Redis

The `redis` store sends commands through the named connection in `connection`, `cache` by default. That connection comes from `RedisManager`, so the [Redis](/docs/redis) config controls the host, database (`REDIS_CACHE_DB`) and Redis key prefix. Resolving the store without `RedisProvider` raises `RuntimeError`.

A key is stored as `<redis prefix><cache prefix>:<key>`. TTLs use `SET ... PX`, so Redis expires entries itself. `flush()` scans for keys under the cache prefix and unlinks them in batches. It never runs `FLUSHDB`, so other data on the same database survives. Because of this, the `redis` store requires a non-empty `CACHE_PREFIX`.

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

await Cache.put("key", "value", 600)
await Cache.put("key", "value", timedelta(minutes=10))
```

A TTL of `None` keeps the value until it is removed. `forever()` says the same thing more clearly:

```python
await Cache.put("key", "value")
await Cache.forever("key", "value")
```

A TTL of zero or less removes the key and returns `False`. `put` returns `True` when the value is stored.

### Retrieving Items

`get` returns the cached value, or `None` when the key is missing or expired:

```python
value = await Cache.get("key")
```

Pass a default to use on a miss. If the default is callable it is called, and if it returns an awaitable that is awaited, so the default can be a plain value, a function, or a coroutine function:

```python
value = await Cache.get("key", "default")
value = await Cache.get("key", lambda: compute())
value = await Cache.get("key", load_from_api)   # async def load_from_api()
```

The default is not stored. Use [`remember`](#remember) for that.

### Checking for Items

`has` tells you whether a key is present and not expired:

```python
if await Cache.has("key"):
    ...
```

A cached `None` counts as present. Stores report misses with a `MISSING` sentinel, so `None`, `0`, `False` and `""` are all values you can cache.

### Remember

`remember(key, ttl, factory)` returns the cached value when there is one. On a miss it calls the factory, caches the result for `ttl`, and returns it. The factory can be sync or async:

```python
users = await Cache.remember("users", 600, lambda: User.all())

async def load_settings():
    return await Setting.where("active", True).get()

settings = await Cache.remember("settings", timedelta(hours=1), load_settings)
```

Pass `None` as the TTL to keep the result until it is removed:

```python
countries = await Cache.remember("countries", None, load_countries)
```

#### As a Decorator

Called without a factory, `remember` returns a decorator. The decorated function becomes async. Each call is cached under the key plus a hash of its arguments, so different arguments get different entries:

```python
from fastapi_startkit.facades import Cache


@Cache.remember("users.profile", 300)
async def profile(user_id: int):
    return await User.find(user_id)


await profile(1)    # runs the query, caches under "users.profile:<hash of (1,)>"
await profile(1)    # served from the cache
await profile(2)    # a different entry
```

Pass `None` as the key to use the function's module and qualified name:

```python
@Cache.remember(None, 60)
def exchange_rates():
    return fetch_rates()
```

The facade resolves the cache manager when the decorated function is called, not when it is decorated, so you can decorate module-level functions before the application boots.

Arguments are hashed from their pickled form, or from `repr()` when they can't be pickled. A call with no arguments uses the key as is.

### Removing Items

```python
await Cache.forget("key")    # True if the key existed
await Cache.flush()          # empty the whole store
```

`flush()` clears every key in the store, not just the keys under your prefix, except on the `redis` store (see [Redis](#redis)). Use it with care on a store that other applications share.

### Using Multiple Stores

`Cache.store(name)` returns the repository for a named store. Each store is created on first use and reused after that:

```python
await Cache.store("file").put("report", data, 3600)
value = await Cache.store("redis").get("report")
```

An unknown name raises `ValueError("Cache store [name] is not defined.")`, and a store whose driver isn't registered raises `ValueError("Cache driver [driver] is not supported.")`.

## Cache Memoization

`Cache.memo()` wraps a store with an in-memory layer. The first `get` of a key reads the store, and later `get`s of the same key return the remembered value without another round trip:

```python
settings = await Cache.memo().get("settings")
settings = await Cache.memo().get("settings")   # no store hit

await Cache.memo("redis").get("feature-flags")
```

Memoized values live for the current asyncio task. Each FastAPI request runs in its own task, so requests never see each other's memo, and the memo goes away when the task ends. Writing through the memo with `put`, `forget` or `flush` drops the memoized copy and then writes to the store.

Writes made through `Cache` directly, or by another process, are not seen by a memo that already read the key. Use memoization for values that stay the same for the length of a request.

## Atomic Locks

A lock makes sure only one owner runs a piece of code at a time, even across processes or servers when the store is shared. All four stores support locks:

| Store | How the lock is held |
|---|---|
| `array` | A dict in the process, so only within one process |
| `file` | A lock file guarded by `fcntl.flock` |
| `database` | A `lock:<name>` row, inserted once; expired rows can be taken over |
| `redis` | `SET NX PX`, released by a Lua script that checks the owner |

`Cache.lock(name, seconds)` creates a lock. `seconds` is how long the lock lasts before it expires on its own. `0`, the default, means it never expires:

```python
lock = Cache.lock("reports.generate", 10)

if await lock.get():
    try:
        await generate_report()
    finally:
        await lock.release()
```

`get()` returns `True` when it acquires the lock and `False` when someone else holds it. Pass a callback and `get()` runs it, releases the lock, and returns the callback's result. The callback can be sync or async:

```python
result = await Cache.lock("reports.generate", 10).get(generate_report)
```

### Context Manager

`async with` acquires the lock, or raises `LockTimeoutError` when it is held, and releases it on exit:

```python
from fastapi_startkit.cache import LockTimeoutError

try:
    async with Cache.lock("reports.generate", 10):
        await generate_report()
except LockTimeoutError:
    ...
```

### Blocking Until Available

`block(seconds)` keeps trying for up to `seconds`, polling every 250 ms, and raises `LockTimeoutError` if it still can't get the lock:

```python
lock = Cache.lock("reports.generate", 10)

await lock.block(5)                         # wait up to 5 seconds
try:
    await generate_report()
finally:
    await lock.release()

await lock.block(5, generate_report)        # wait, run, release
```

### Owners and Releasing

Each lock has an owner token, random by default. `release()` only releases the lock if this owner holds it, and returns `False` otherwise. To release a lock from another process, for example a queued job, pass the owner token along:

```python
lock = Cache.lock("processing", 120)

if await lock.get():
    await queue_job(owner=lock.owner)

# later, in the job that received the owner token
await Cache.lock("processing", 120, owner).release()
```

`force_release()` removes the lock whoever owns it:

```python
await Cache.lock("processing").force_release()
```

Locks are not re-entrant. A second `get()` by the same owner while the lock is held returns `False`. A lock created through `Cache.memo()` or `Cache.tags()` raises `TypeError`, because those wrappers don't support locks; take the lock from `Cache` or `Cache.store(name)`.

## Cache Tags

Tags group related entries so you can flush them together. `Cache.tags(names)` returns a repository whose keys belong to those tags:

```python
await Cache.tags(["people", "artists"]).put("John", john, 600)
await Cache.tags(["people", "authors"]).put("Anne", anne, 600)

john = await Cache.tags(["people", "artists"]).get("John")
```

Read an entry with the same set of tags you stored it with. The order and duplicates don't matter, so `["artists", "people"]` finds the same entry. A single tag can be a string:

```python
await Cache.tags("settings").remember("theme", None, load_theme)
```

Flushing a tag set invalidates every entry stored with any of those tags:

```python
await Cache.tags("people").flush()       # removes John and Anne
await Cache.tags("authors").flush()      # removes Anne only
```

Tags follow Laravel's namespaced keys. Each tag has a random id stored at `<prefix>:tag:<name>:key`, and an entry is stored under a hash of its tags' ids. Flushing gives the tags new ids, so old entries can no longer be found. They are not deleted right away; they expire with their TTL, or stay until the store is flushed if they had none.

`Cache.tags([])` raises `ValueError`. Tags work with every store, including `Cache.store("redis").tags(...)`.

## Custom Stores

A store is any object with four async methods. `get` returns `MISSING` on a miss:

```python
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

Register a factory for a driver name with `Cache.extend()`, for example in a provider's `boot()`. The factory receives the store's config dict:

```python
from fastapi_startkit.facades import Cache

Cache.extend("null", lambda config: NullStore())
```

Then add a store that uses the driver:

```python
@dataclass
class CacheConfig(Config):
    stores: dict[str, Config | dict] = field(
        default_factory=lambda: {
            "array": ArrayStoreConfig(),
            "null": {"driver": "null"},
        }
    )
```

To support locks, give the store a `lock(name, seconds, owner)` method that returns a subclass of `fastapi_startkit.cache.Lock` implementing `acquire`, `release` and `force_release`.

## Differences From Laravel

- Everything is async. Await every read and write, `remember`, and every lock method.
- TTLs are seconds or a `timedelta`. There is no `DateTime` TTL.
- `remember` takes the TTL and the factory as arguments and works as a decorator; there is no separate `rememberForever`. Use `remember(key, None, factory)`.
- Not implemented yet: `add`, `pull`, `increment`/`decrement`, `many`/`putMany`, `flexible`, cache events, and the `memcached`, `dynamodb` and `null` drivers.
- An unknown store raises `ValueError`, not `InvalidArgumentException`.
