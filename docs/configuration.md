# Configuration

fastapi-startkit uses environment variables as the source of truth for configuration. The application loads the appropriate `.env` file on boot, and config classes read from those variables when instantiated.

## Loading Environment Variables

`Application` loads your `.env` automatically when it boots — you don't need to call anything extra:

```python
from fastapi_startkit import Application, Config
from pathlib import Path

app = Application(base_path=Path().cwd())
# .env is already loaded at this point
```

To target an environment-specific file, pass `env` to the constructor:

```python
app = Application(base_path=Path().cwd(), env='production')
```

`.env` is always loaded first. If an environment is set and `.env.<environment>` exists, it is loaded on top, overriding any matching keys:

```
.env                ← always loaded
.env.production     ← loaded on top when env="production" (if exists)
.env.testing        ← loaded on top when env="testing"    (if exists)
```

### Choosing the Environment via the CLI

In practice you rarely hardcode the environment. Pass `--env` on the command line instead — the `artisan` entry point picks it up before any command runs:

```bash
uv run artisan --env=production   # .env → .env.production
uv run artisan --env=testing      # .env → .env.testing
uv run artisan                    # .env only
```

### The `env()` Helper

Inside any config, use `env()` to read a variable. It auto-casts values so you don't have to:

| Raw string in `.env` | Python value |
|---|---|
| `"true"` / `"True"` | `True` |
| `"false"` / `"False"` | `False` |
| Numeric string | `int` |
| Everything else | `str` |
| Missing + default given | the default |

```python
from fastapi_startkit.environment import env

env('REDIS_HOST')              # str
env('REDIS_PORT')              # int (auto-cast)
env('DEBUG', False)            # False if not set
env('SOME_VALUE', cast=False)  # always raw str
```

## Defining Config from Environment Variables

Define your config as a plain dataclass. Each field uses `default_factory` so the value is read from the environment at the moment you instantiate it — not when the class is defined. Instantiate only after the application has booted:

```python
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

## Reading Config

For most cases, just instantiate the dataclass where you need it:

```python
RedisConfig().host     # 'host.testing'
RedisConfig().port     # 6379
RedisConfig().options  # {'decode_responses': True}
```

No service locator, no injection — just a plain Python object.

### Registering with Config

If you want to access config via dotted keys, share it across services, or override values at runtime, use the `Config` static class:

```python
from fastapi_startkit import Config

Config.set('redis', RedisConfig())

Config.get('redis.host')                      # 'host.testing'
Config.get('redis.options')                   # {'decode_responses': True}
Config.get('redis.options.decode_responses')  # True
```

You can also check, override, or inspect at runtime:

```python
Config.has('redis.host')               # True
Config.set('redis.host', 'new-host')   # override at runtime
Config.all()                           # full dict of everything registered
```
