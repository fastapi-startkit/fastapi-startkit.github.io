---
outline: deep
title: Configuration
description: Read settings from environment files into typed config classes.
keywords: configuration, environment, settings, fastapi
---

# Configuration

Configuration comes from environment variables. The application loads your `.env` files when it boots, and config classes read those variables when you create them.

## Loading Environment Variables

`Application` loads `.env` when you create it:

```python
from fastapi_startkit import Application
from pathlib import Path

app = Application(base_path=Path(__file__).parent.parent)
```

`APP_ENV` sets the environment name. Set it in the process or in `.env`; if it's missing, the app raises a `ValueError` on boot. Under pytest it is always `testing`.

To pick the environment in code, pass `env` to the constructor. It takes priority over `APP_ENV`:

```python
app = Application(base_path=Path(__file__).parent.parent, env='production')
```

`.env` is loaded first. If `.env.<environment>` exists, it is loaded on top and its keys win:

```
.env                ← always loaded
.env.production     ← loaded on top when env="production" (if exists)
.env.testing        ← loaded on top when env="testing"    (if exists)
```

### Choosing the Environment via the CLI

Pass `--env` to `artisan`. It is read before any command runs:

```bash
uv run python artisan --env=production   # .env → .env.production
uv run python artisan --env=testing      # .env → .env.testing
uv run python artisan                     # .env, plus .env.<APP_ENV> if it exists
```

### The `env()` Helper

`env(name, default, cast=True)` reads an environment variable. It returns a dataclass field, so use it as the default of a field on a config class. The variable is read when you create an instance:

```python
from dataclasses import dataclass
from fastapi_startkit.environment import env

@dataclass
class AppConfig:
    name: str = env('APP_NAME', 'startkit')
    port: int = env('APP_PORT', 8000)
    debug: bool = env('APP_DEBUG', False)
```

How the value is cast depends on the default:

| Call | Result |
|---|---|
| `env('NAME')` or `env('NAME', None)` | `"true"`/`"True"` → `True`, `"false"`/`"False"` → `False`, digits only → `int`, anything else stays `str` |
| `env('NAME', False)` (a `bool` default) | `"true"`/`"True"`/`"false"`/`"False"` → `bool`; any other value raises `ValueError` |
| `env('NAME', 6379)` (any other default) | converted to the default's type: `int` here, `str` for `env('NAME', '')` |
| `env('NAME', ..., cast=False)` | the raw string |
| Variable unset | the default, or `''` when there is none |

"Digits only" means `str.isnumeric()`, so `'-5'` and `'1.5'` stay strings. A string default never casts: with `REDIS_PORT=8080`, `env('REDIS_PORT', '')` gives `'8080'`.

### Reading a Value Outside a Class

`value()` resolves an `env()` field to its value. Use it when you need one variable outside a config class:

```python
from fastapi_startkit.environment import env, value

port = value(env('REDIS_PORT', 6379))   # 8080 when REDIS_PORT=8080
```

`value()` returns anything that isn't a field unchanged, so `value('8080')` is `'8080'`. To cast a value you already have, use `into()`:

```python
from fastapi_startkit.environment import into

into('8080')    # 8080
into('false')   # False
into('redis')   # 'redis'
```

## Defining Config from Environment Variables

Put each group of settings in its own dataclass under `config/`. Create instances only after the application has booted, so the `.env` files are loaded:

```python
# config/redis.py
from dataclasses import dataclass, field
from fastapi_startkit.environment import env

@dataclass
class RedisConfig:
    host: str  = env('REDIS_HOST')
    port: int  = env('REDIS_PORT')
    db: int    = env('REDIS_DB')
    options: dict = field(default_factory=lambda: {
        'decode_responses': True
    })
```

Each new instance reads the environment as it is at that moment:

```python
from config.redis import RedisConfig

RedisConfig().host     # 'localhost' when REDIS_HOST=localhost
RedisConfig().port     # 6379 when REDIS_PORT=6379
RedisConfig().options  # {'decode_responses': True}
```

## Switching Environment at Runtime

To change the environment after boot, call `set_environment()` and then `load_environment()`. Config instances created afterwards read the new values. Use this in scripts and test setup that need another environment without restarting the process:

```python
# .env         →  REDIS_HOST=host.default
# .env.testing →  REDIS_HOST=host.testing

RedisConfig().host  # 'host.default'

app.set_environment('testing')
app.load_environment()

RedisConfig().host  # 'host.testing'
```

### Registering with Config

Register an instance with `Config` to read it by dotted key from anywhere:

```python
from fastapi_startkit import Config
from config.redis import RedisConfig

Config.set('redis', RedisConfig())

Config.get('redis.host')                      # REDIS_HOST when RedisConfig() was created
Config.get('redis.options')                   # {'decode_responses': True}
Config.get('redis.options.decode_responses')  # True
```

`Config.set()` stores the instance's values as they are. If the environment changes later, create a new instance and call `Config.set()` again.

Check, override, or list values:

```python
Config.has('redis.host')               # True
Config.set('redis.host', 'new-host')   # override at runtime
Config.all()                           # full dict of everything registered
```
