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

## Config Classes Without a Base Class

The framework describes application and database settings with structural protocols, not base classes. Any object with the right attributes is accepted, so your config class doesn't have to subclass `AppConfig` or `DatabaseConfig`.

### Application Settings

`fastapi_startkit.application.AppSettings` is a `runtime_checkable` `Protocol` with four attributes:

| Attribute | Type |
|---|---|
| `name` | `str` |
| `env` | `str` |
| `debug` | `bool` |
| `timezone` | `str` |

`Application`'s config type is bound to this protocol, so a plain dataclass type-checks and keeps any extra fields you add:

```python
# config/app.py
from dataclasses import dataclass
from fastapi_startkit import environment

@dataclass
class AppConfig:
    name: str = environment.env('APP_NAME', 'startkit')
    env: str = environment.env('APP_ENV', 'local')
    debug: bool = environment.env('APP_DEBUG', False)
    timezone: str = environment.env('APP_TIMEZONE', 'UTC')
    region: str = environment.env('APP_REGION', 'eu')
```

```python
from config.app import AppConfig

app = Application(base_path=Path(__file__).parent.parent, config=AppConfig)
app.config.region   # 'eu'
```

The example calls `environment.env()` because a field named `env` would shadow an imported `env()` helper for the fields below it.

### Database Settings

`fastapi_startkit.masoniteorm.config.database.DatabaseSettings` is a `runtime_checkable` `Protocol` with three read-only members:

| Member | Type |
|---|---|
| `default` | `str`, the name of the default connection |
| `connections` | `Mapping[str, DBConfig]`, connection configs such as `SQLiteConfig` or `PostgresConfig` |
| `migrations` | `Mapping[str, str]`, from which the migration commands read `directory` |

Any object with that shape boots, whether it's a dataclass, a pydantic model, a plain class or a `SimpleNamespace`. When the object defines `migrations`, `DatabaseProvider` uses it as-is rather than copying it. Extra dataclass fields are kept under the `database` key:

```python
# config/database.py
from dataclasses import dataclass, field
from fastapi_startkit.environment import env
from fastapi_startkit.masoniteorm import DBConfig, PostgresConfig

@dataclass
class DatabaseConfig:
    default: str = env('DB_CONNECTION', 'postgres')
    connections: dict[str, DBConfig] = field(default_factory=lambda: {
        'postgres': PostgresConfig(host=env('DB_HOST', 'localhost')),
    })
    migrations: dict[str, str] = field(default_factory=lambda: {
        'table': 'migrations',
        'directory': 'databases/migrations',
    })
    pool: int = 5
```

```python
Config.get('database.pool')                   # 5
Config.get('database.migrations.directory')   # 'databases/migrations'
```

The `table` key is declared for completeness, but the migrator always uses a table named `migrations`.

If your config has no `migrations` attribute, the provider fills in the framework default, `{'table': 'migrations', 'directory': 'databases/migrations'}`. Configs written before `migrations` joined the protocol keep booting:

```python
from types import SimpleNamespace
from fastapi_startkit.masoniteorm import DatabaseProvider, SQLiteConfig

settings = SimpleNamespace(default='sqlite', connections={'sqlite': SQLiteConfig()})

app = Application(base_path=base_path, providers=[(DatabaseProvider, settings)])
```

In that case the provider passes the database manager a new `SimpleNamespace` holding only `default`, `connections` and `migrations`, so extra attributes and methods of your object are not available on `app.make('db').config`. `Config.get('database.<field>')` still returns extra dataclass fields, because the `database` entry is built from your original object. A source that supplies `migrations` only through `__getattr__` gets no fallback and fails the protocol check, so declare it as a real attribute.

Every connection must be a `DBConfig` instance, or the provider raises `TypeError` on boot. An object missing `default` or `connections` raises a `TypeError` that names what's missing:

```
TypeError: DatabaseProvider requires DatabaseSettings; missing attributes: connections
```

### Checking Your Own Settings

`fastapi_startkit.support.config.ensure_config(owner, source, protocol)` runs the same check against any `runtime_checkable` protocol. When `isinstance(source, protocol)` passes, it returns `source` typed as the protocol. Otherwise it raises `TypeError` naming the owner, the protocol, and every missing member, including members inherited from parent protocols:

```python
from types import SimpleNamespace
from fastapi_startkit.application import AppSettings
from fastapi_startkit.masoniteorm import SQLiteConfig
from fastapi_startkit.masoniteorm.config.database import DatabaseSettings
from fastapi_startkit.support.config import ensure_config

settings = SimpleNamespace(
    default='sqlite',
    connections={'sqlite': SQLiteConfig()},
    migrations={'table': 'migrations', 'directory': 'databases/migrations'},
)

database = ensure_config('ReportService', settings, DatabaseSettings)
database.default   # typed as str

ensure_config('ReportService', object(), AppSettings)
# TypeError: ReportService requires AppSettings; missing attributes: name, env, debug, timezone
```

`ensure_config` only checks; it never fills in defaults. The `migrations` fallback described above happens in `DatabaseProvider`, so passing a settings object without `migrations` to `ensure_config` raises `TypeError: ReportService requires DatabaseSettings; missing attributes: migrations`.

### When to Keep the Base Class

`AppConfig`, `DatabaseConfig` and the other `Config` subclasses work as before and remain the defaults. Subclass one of them, or `fastapi_startkit.support.config.Config`, when you need either of these:

- **`env()` as a constructor argument.** In a plain dataclass, `env()` works as a field default, but `MyConfig(default=env('DB_CONNECTION'))` stores the unresolved field instead of the variable's value.
- **Class-level defaults.** Reading a default from the class, such as `DatabaseConfig.connections`, needs the base class.
