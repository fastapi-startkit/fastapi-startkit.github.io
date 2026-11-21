---
outline: deep
title: Configuration
description: Read settings from environment files into typed config classes.
keywords: configuration, environment, settings, fastapi
---

# Configuration

Settings such as database credentials, API keys and ports change from one environment to the next. The framework keeps them in `.env` files and reads them into typed config classes, so the same code runs on your laptop and in production with a different `.env` file.

- [Loading Environment Variables](#loading-environment-variables)
- [Defining Config Classes](#defining-config-classes)
- [Accessing Configuration Values](#accessing-configuration-values)
- [Application Settings](#application-settings)
- [Switching Environment at Runtime](#switching-environment-at-runtime)
- [Using Your Own Config Classes](#using-your-own-config-classes)

## Loading Environment Variables

The application loads your environment files as soon as you create it. `APP_ENV` names the environment, and you can set it in the process environment or in `.env`:

```ini
# .env
APP_ENV=local
DB_CONNECTION=sqlite
```

`.env` is always loaded first. If a `.env.<environment>` file exists, it is loaded on top of it and its values win:

```text
.env              loaded first
.env.production   loaded on top when the environment is production
.env.testing      loaded on top when the environment is testing
```

Values in these files overwrite variables that are already set in the process environment. For example, if your shell exports `DB_HOST=db.internal` and `.env` contains `DB_HOST=127.0.0.1`, the application sees `127.0.0.1`. Leave a variable out of `.env` when you want the process environment to provide it.

Creating the application fails when it can't find an environment name:

- With no `APP_ENV` in the process environment and no `.env` file, it raises `ValueError: Unable to determine environment.`
- With a `.env` file that doesn't set `APP_ENV`, it raises `ValueError: APP_ENV not set after loading .env`.

Under pytest the environment is always `testing`.

### Choosing the Environment via the CLI

Pass `--env` to any command to choose the environment. The option sets `app.env`, picks which `.env.<environment>` file is loaded, and is removed before the command runs:

```bash
uv run python artisan serve --env=production   # .env, then .env.production
uv run python artisan db:migrate --env testing # .env, then .env.testing
```

::: warning
`--env`, or an `APP_ENV` exported in your shell, does not change the `APP_ENV` variable that your config classes read. After `.env` is loaded, `APP_ENV` and `AppConfig.env` hold the value from `.env`. Read the active environment from `app.env`, or set `APP_ENV` again in the matching file, for example `APP_ENV=production` in `.env.production`.
:::

### Checking the Current Environment

`app.env` holds the active environment name, and `app.is_testing()` tells you whether it is `testing`:

```python
from bootstrap.application import app

app.env          # 'production'
app.is_testing() # False
```

## Defining Config Classes

Put each group of settings in a dataclass under `config/`, and use `env()` as the default of each field. `env()` reads the variable each time you create an instance:

```python
# config/billing.py
from dataclasses import dataclass, field

from fastapi_startkit.environment import env


@dataclass
class BillingConfig:
    currency: str = env("BILLING_CURRENCY", "usd")
    trial_days: int = env("BILLING_TRIAL_DAYS", 14)
    send_receipts: bool = env("BILLING_SEND_RECEIPTS", True)
    stripe_secret: str = env("STRIPE_SECRET", "")
    retry: dict = field(default_factory=lambda: {"attempts": 3, "backoff": 60})
```

```python
BillingConfig()
# BillingConfig(currency='usd', trial_days=14, send_receipts=True, stripe_secret='', retry={...})
```

Create instances after the application exists, so the `.env` files are already loaded.

### The `env()` Helper

`env(name, default, cast=True)` reads an environment variable. The default decides how the value is cast:

| Call | Result |
|---|---|
| `env("NAME")` or `env("NAME", None)` | `"true"`/`"True"` → `True`, `"false"`/`"False"` → `False`, digits only → `int`, anything else stays `str` |
| `env("NAME", False)` (a `bool` default) | `"true"`/`"True"`/`"false"`/`"False"` → `bool`; any other value raises `ValueError` |
| `env("NAME", 6379)` (any other default) | Converted to the default's type: `int` here, `str` for `env("NAME", "")` |
| `env("NAME", cast=False)` | The raw string |
| Variable unset | The default, or `""` when there is none |

"Digits only" means `str.isnumeric()`, so `"-5"` and `"1.5"` stay strings. A string default never casts: with `REDIS_PORT=8080`, `env("REDIS_PORT", "")` gives `"8080"`.

### Reading a Value Outside a Class

`env()` returns a dataclass field. To read a single variable outside a config class, pass that field to `value()`:

```python
from fastapi_startkit.environment import env, value

port = value(env("REDIS_PORT", 6379))   # 8080 when REDIS_PORT=8080
```

`value()` returns anything that isn't a field unchanged. To cast a string you already have, use `into()`:

```python
from fastapi_startkit.environment import into

into("8080")    # 8080
into("false")   # False
into("redis")   # 'redis'
```

## Accessing Configuration Values

The `Config` facade stores configuration under keys that you read with dot notation. Register your config class in a provider's `register()` method:

```python
# providers/billing_provider.py
from fastapi_startkit.facades import Config
from fastapi_startkit.support import Provider

from config.billing import BillingConfig


class BillingProvider(Provider):
    def register(self) -> None:
        Config.set("billing", BillingConfig())
```

Then read values from anywhere in the application:

```python
from fastapi_startkit.facades import Config

Config.get("billing.currency")        # 'usd'
Config.get("billing.retry.attempts")  # 3
Config.get("billing.coupon", "none")  # 'none', the default for a missing key
```

Framework providers register their config the same way, under their own key. For example, `Config.get("fastapi.app_url")` returns the URL the `serve` command binds to.

You can also check, override and list values:

```python
Config.has("billing.currency")        # True
Config.set("billing.currency", "gbp") # override a single value
Config.all()                          # everything registered, keyed by name
```

`Config.set()` stores the values the instance had when you registered it. If the environment changes later, create a new instance and call `Config.set()` again.

## Application Settings

The `config` argument of `Application` takes the class that holds the application's own settings. Read them from `app.config`:

```python
from bootstrap.application import app

app.config.name    # 'example-project'
app.config.debug   # True
```

Without a `config` argument the application uses `fastapi_startkit.config.AppConfig`:

| Field | Environment variable | Default |
|---|---|---|
| `name` | `APP_NAME` | `FastAPI starter kit` |
| `env` | `APP_ENV` | `development` |
| `debug` | `APP_DEBUG` | `True` |
| `timezone` | `APP_TIMEZONE` | `UTC` |

::: warning
`APP_DEBUG` defaults to `True`, and in debug mode an unhandled exception returns its message and stack trace in the response. Set `APP_DEBUG=false` in production.
:::

## Switching Environment at Runtime

To load another environment after the application has started, call `set_environment()` and then `load_environment()`. Config instances you create afterwards read the new values. This is useful in scripts and test setup:

```python
# .env          BILLING_CURRENCY=usd
# .env.testing  BILLING_CURRENCY=eur

BillingConfig().currency  # 'usd'

app.set_environment("testing").load_environment()

BillingConfig().currency  # 'eur'
```

Values already stored with `Config.set()` don't change until you register a new instance.

## Using Your Own Config Classes

The application and database settings are described by protocols, not base classes. Any object with the right attributes works, so a plain dataclass, a Pydantic model or a `SimpleNamespace` can be your config.

### Application Config

`fastapi_startkit.application.AppSettings` requires four attributes:

| Attribute | Type |
|---|---|
| `name` | `str` |
| `env` | `str` |
| `debug` | `bool` |
| `timezone` | `str` |

Add any extra fields you need. Declare the `env` field last, because a field named `env` hides the `env()` helper for the fields below it:

```python
# config/app.py
from dataclasses import dataclass

from fastapi_startkit.environment import env


@dataclass
class AppConfig:
    name: str = env("APP_NAME", "billing")
    debug: bool = env("APP_DEBUG", False)
    timezone: str = env("APP_TIMEZONE", "UTC")
    region: str = env("APP_REGION", "eu")
    env: str = env("APP_ENV", "local")
```

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from config.app import AppConfig

app = Application(base_path=Path(__file__).resolve().parent.parent, config=AppConfig)

app.config.region   # 'eu'
```

`AppConfig.env` reads `APP_ENV` after the `.env` files are loaded, so it can differ from `app.env` when you pass `--env`. See [Choosing the Environment via the CLI](#choosing-the-environment-via-the-cli).

### Database Config

`fastapi_startkit.masoniteorm.config.database.DatabaseSettings` requires three read-only members:

| Member | Type |
|---|---|
| `default` | `str`, the name of the default connection |
| `connections` | `Mapping[str, DBConfig]`, connection configs such as `SQLiteConfig` or `PostgresConfig` |
| `migrations` | `Mapping[str, str]` with `table` and `directory` keys |

Extra dataclass fields are kept and readable through `Config`:

```python
# config/database.py
from dataclasses import dataclass, field

from fastapi_startkit.environment import env
from fastapi_startkit.masoniteorm import DBConfig, SQLiteConfig


@dataclass
class DatabaseConfig:
    default: str = env("DB_CONNECTION", "sqlite")
    connections: dict[str, DBConfig] = field(default_factory=lambda: {
        "sqlite": SQLiteConfig(database=env("DB_DATABASE", "databases/app.sqlite")),
    })
    migrations: dict[str, str] = field(default_factory=lambda: {
        "table": "migrations",
        "directory": "databases/migrations",
    })
    pool_size: int = env("DB_POOL_SIZE", 5)
```

```python
Config.get("database.pool_size")             # 5
Config.get("database.migrations.directory")  # 'databases/migrations'
```

If your config has no `migrations` attribute, `DatabaseProvider` uses `{"table": "migrations", "directory": "databases/migrations"}`:

```python
# bootstrap/application.py
from pathlib import Path
from types import SimpleNamespace

from fastapi_startkit import Application
from fastapi_startkit.masoniteorm import DatabaseProvider, SQLiteConfig

settings = SimpleNamespace(default="sqlite", connections={"sqlite": SQLiteConfig()})

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[(DatabaseProvider, settings)],
)
```

The provider checks the object when it registers. A missing member or a connection that isn't a connection config raises `TypeError`:

```text
TypeError: DatabaseProvider requires DatabaseSettings; missing attributes: connections
TypeError: Database connection 'sqlite' requires a database config object
```

### Checking Your Own Settings

`ensure_config(owner, source, protocol)` runs the same check against any `runtime_checkable` protocol. It returns `source` typed as the protocol, or raises `TypeError` naming the owner, the protocol and every missing member:

```python
from types import SimpleNamespace

from fastapi_startkit.application import AppSettings
from fastapi_startkit.support.config import ensure_config

settings = SimpleNamespace(name="billing", env="local", debug=False, timezone="UTC")

app_settings = ensure_config("ReportService", settings, AppSettings)
app_settings.timezone   # 'UTC'

ensure_config("ReportService", object(), AppSettings)
# TypeError: ReportService requires AppSettings; missing attributes: name, env, debug, timezone
```

`ensure_config` only checks. It never fills in defaults.

### Extending the Base Config Class

The framework's own config classes extend `fastapi_startkit.configuration.Config`. Extend it in your dataclass when you need either of these:

- **`env()` as a constructor argument.** `BillingConfig(currency=env("BILLING_CURRENCY", "usd"))` resolves the variable. On a plain dataclass it stores the unresolved field instead.
- **Defaults read from the class.** `DatabaseConfig.migrations` returns the default value. On a plain dataclass it raises `AttributeError`.

```python
# config/billing.py
from dataclasses import dataclass

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env


@dataclass
class BillingConfig(Config):
    currency: str = env("BILLING_CURRENCY", "usd")
```
