---
outline: deep
title: Configuration
description: Read settings from environment files into typed config classes.
keywords: configuration, environment, settings, fastapi
---

# Configuration

Most of your application's settings, such as database credentials, API keys, and ports, change from one environment to the next. FastAPI Startkit keeps them in environment variables, so the same code runs on your laptop and in production with nothing more than a different `.env` file.

The application loads your `.env` files when it boots, and your config classes read those variables when you create them. You get typed, grouped settings without hard-coding a single value.

## Loading Environment Variables

As soon as you create an `Application`, it loads your `.env` file:

```python
from fastapi_startkit import Application
from pathlib import Path

app = Application(base_path=Path(__file__).parent.parent)
```

The `APP_ENV` variable sets the environment name. You can set it in the process or in `.env`; if it's missing, the app raises a `ValueError` on boot. Under pytest it is always `testing`.

If you'd rather pick the environment in code, pass `env` to the constructor. It takes priority over `APP_ENV`:

```python
app = Application(base_path=Path(__file__).parent.parent, env='production')
```

`.env` is always loaded first. If a matching `.env.<environment>` file exists, it is loaded on top, and its keys win:

```
.env                ← always loaded
.env.production     ← loaded on top when env="production" (if exists)
.env.testing        ← loaded on top when env="testing"    (if exists)
```

### Choosing the Environment via the CLI

You can also choose the environment from the command line by passing `--env` to `artisan`. It is read before any command runs:

```bash
uv run python artisan --env=production   # .env → .env.production
uv run python artisan --env=testing      # .env → .env.testing
uv run python artisan                     # .env, plus .env.<APP_ENV> if it exists
```

### The `env()` Helper

`env(name, default, cast=True)` reads an environment variable. Because it returns a dataclass field, you use it as the default of a field on a config class. The variable is read each time you create an instance:

```python
from dataclasses import dataclass
from fastapi_startkit.environment import env

@dataclass
class AppConfig:
    name: str = env('APP_NAME', 'startkit')
    port: int = env('APP_PORT', 8000)
    debug: bool = env('APP_DEBUG', False)
```

How the value is cast depends on the default you give it:

| Call | Result |
|---|---|
| `env('NAME')` or `env('NAME', None)` | `"true"`/`"True"` → `True`, `"false"`/`"False"` → `False`, digits only → `int`, anything else stays `str` |
| `env('NAME', False)` (a `bool` default) | `"true"`/`"True"`/`"false"`/`"False"` → `bool`; any other value raises `ValueError` |
| `env('NAME', 6379)` (any other default) | converted to the default's type: `int` here, `str` for `env('NAME', '')` |
| `env('NAME', ..., cast=False)` | the raw string |
| Variable unset | the default, or `''` when there is none |

"Digits only" means `str.isnumeric()`, so `'-5'` and `'1.5'` stay strings. A string default never casts: with `REDIS_PORT=8080`, `env('REDIS_PORT', '')` gives `'8080'`.

### Reading a Value Outside a Class

Sometimes you just need a single variable outside a config class. For that, `value()` resolves an `env()` field to its value:

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

Put each group of settings in its own dataclass under `config/`. Make sure you create instances only after the application has booted, so the `.env` files are already loaded:

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

To change the environment after boot, call `set_environment()` and then `load_environment()`. Config instances you create afterwards read the new values. This comes in handy in scripts and test setup that need another environment without restarting the process:

```python
# .env         →  REDIS_HOST=host.default
# .env.testing →  REDIS_HOST=host.testing

RedisConfig().host  # 'host.default'

app.set_environment('testing')
app.load_environment()

RedisConfig().host  # 'host.testing'
```

### Registering with Config

Once you register an instance with `Config`, you can read it by dotted key from anywhere in your application:

```python
from fastapi_startkit import Config
from config.redis import RedisConfig

Config.set('redis', RedisConfig())

Config.get('redis.host')                      # REDIS_HOST when RedisConfig() was created
Config.get('redis.options')                   # {'decode_responses': True}
Config.get('redis.options.decode_responses')  # True
```

Keep in mind that `Config.set()` stores the instance's values as they are at that moment. If the environment changes later, create a new instance and call `Config.set()` again.

You can also check, override, or list values:

```python
Config.has('redis.host')               # True
Config.set('redis.host', 'new-host')   # override at runtime
Config.all()                           # full dict of everything registered
```
