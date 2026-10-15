---
outline: deep
title: Configuration
description: Manage your application settings using Fastapi Startkit's flexible configuration system.
keywords: configuration, environment, settings, fastapi
---

# Configuration

fastapi-startkit uses environment variables as the source of truth for configuration. The application loads the appropriate `.env` file on boot, and config classes read from those variables when instantiated.

## Loading Environment Variables

`Application` loads your `.env` automatically when it boots — you don't need to call anything extra:

```python
from fastapi_startkit import Application
from pathlib import Path

app = Application(base_path=Path(__file__).parent.parent)
# .env is already loaded at this point
```

If there is no `.env` file, set `APP_ENV` in the process environment instead. Otherwise boot raises `ValueError: Unable to determine environment.`

To target an environment-specific file, pass `env` to the constructor:

```python
app = Application(base_path=Path(__file__).parent.parent, env='production')
```

An explicit `env` argument takes priority over `APP_ENV`. `.env` is always loaded first. If an environment is set and `.env.<environment>` exists, it is loaded on top, overriding any matching keys:

```
.env                ← always loaded
.env.production     ← loaded on top when env="production" (if exists)
.env.testing        ← loaded on top when env="testing"    (if exists)
```

### Choosing the Environment via the CLI

In practice you rarely hardcode the environment. Pass `--env` on the command line instead — the `artisan` entry point picks it up before any command runs:

```bash
uv run python artisan --env=production   # .env → .env.production
uv run python artisan --env=testing      # .env → .env.testing
uv run python artisan                     # .env only
```

### The `env()` Helper

Inside any config, use `env()` to read a variable. Its signature is `env(name, default="", cast=True)`:

| Call | Result |
|---|---|
| `env('NAME')` — no default | auto-cast: `"true"`/`"false"` → `bool`, numeric string → `int`, anything else → `str` |
| `env('NAME', default)` — default is `""` or `None` | same auto-cast as above |
| `env('NAME', default)` — default is a `bool` | `"true"`/`"True"` → `True`, `"false"`/`"False"` → `False`, anything else raises `ValueError` |
| `env('NAME', default)` — default is any other type | value converted to the default's type, e.g. `env('REDIS_PORT', 6379)` → `int` |
| `env('NAME', ..., cast=False)` | raw string, or the default if the variable is unset |
| Variable unset | the default |

```python
from fastapi_startkit.environment import env

env('REDIS_HOST')                 # str
env('REDIS_PORT')                 # int (auto-cast)
env('REDIS_PORT', 6379)           # int, even if REDIS_PORT is unset
env('DEBUG', False)               # False if not set
env('SOME_VALUE', cast=False)     # raw str
```

### The `value()` Helper

`value()` applies the same auto-cast to a value you already have, such as a string read from elsewhere:

```python
from fastapi_startkit.environment import value

value('8080')    # 8080
value('false')   # False
value('redis')   # 'redis'
```

## Defining Config from Environment Variables

Define your config as a plain dataclass. Each field uses `default_factory` so the value is read from the environment at the moment you instantiate it — not when the class is defined. Instantiate only after the application has booted:

```python
# config/redis.py
from dataclasses import dataclass, field
from fastapi_startkit.environment import env

@dataclass
class RedisConfig:
    host: str  = field(default_factory=lambda: env('REDIS_HOST'))
    port: int  = field(default_factory=lambda: env('REDIS_PORT'))
    db: int    = field(default_factory=lambda: env('REDIS_DB'))
    options: dict = field(default_factory=lambda: {
        'decode_responses': True
    })
```

Once defined, import and instantiate it anywhere — values are read from the active environment at that moment:
```python
from config.redis import RedisConfig

RedisConfig().host     # str  — value of REDIS_HOST
RedisConfig().port     # int  — auto-cast from REDIS_PORT
RedisConfig().options  # {'decode_responses': True}
```

## Switching Environment at Runtime

You can change the active environment after boot by calling `set_environment()` followed by `load_environment()`. Any config instantiated after that call will reflect the new environment:

```python
# .env         →  REDIS_HOST=host.default
# .env.testing →  REDIS_HOST=host.testing

RedisConfig().host  # 'host.default'

app.set_environment('testing')
app.load_environment()

RedisConfig().host  # 'host.testing'
```

This is useful in scripts or test setups where you need to target a specific environment without restarting the process.

### Registering with Config

If you want to access config via dotted keys, share it across services, or override values at runtime, use the `Config` static class:

```python
from fastapi_startkit import Config
from config.redis import RedisConfig

Config.set('redis', RedisConfig())

Config.get('redis.host')                      # value of REDIS_HOST when set() was called
Config.get('redis.options')                   # {'decode_responses': True}
Config.get('redis.options.decode_responses')  # True
```

`Config.set()` stores a snapshot of the dataclass's values. After changing the environment, call `Config.set()` again to refresh the registered values.

You can also check, override, or inspect at runtime:

```python
Config.has('redis.host')               # True
Config.set('redis.host', 'new-host')   # override at runtime
Config.all()                           # full dict of everything registered
```
