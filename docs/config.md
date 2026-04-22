---
outline: deep
title: Configuration
---

# Configuration

Fastapi Startkit provides a robust configuration system that handles everything from environment variables to global application settings.

## Environment Files

By default, Fastapi Startkit loads the `.env` file from your project's root directory.

### Environment-Specific Files
Before loading your application's environment variables, Fastapi Startkit checks if an `APP_ENV` environment variable is set (or if the `--env` CLI argument is specified). 

If `APP_ENV` is set to `production`, it will attempt to load `.env.production`. If that file doesn't exist, it falls back to the default `.env`.

### Retrieving Environment Values
While you can use `os.getenv()`, we recommend using the `env()` helper which provides better handling for default values and common types (like booleans).

```python
from fastapi_startkit.environment import env

debug = env("APP_DEBUG", False)
db_port = env("DB_PORT", 5432)
```

---

## Global Application Settings

You can pass a global configuration class (typically a dataclass) to the `Application` constructor. This class serves as the central hub for your application's settings.

### 1. Define the Config Class
Create a dataclass in `config/app.py`:

```python
from dataclasses import dataclass, field
from fastapi_startkit.environment import env

@dataclass
class AppConfig:
    name: str = field(default_factory=lambda: env("APP_NAME", "My App"))
    debug: bool = field(default_factory=lambda: env("APP_DEBUG", False))
    timezone: str = field(default_factory=lambda: env("APP_TIMEZONE", "UTC"))
```

### 2. Register with Application
Pass the class to the `Application` instance during bootstrap:

```python
# bootstrap/application.py
from config.app import AppConfig
from fastapi_startkit import Application

app = Application(
    base_path=...,
    config=AppConfig,
    providers=[...]
)
```

---

## Accessing Configuration

There are two primary ways to access your configuration values throughout the application.

### 1. Resolving via Application
If you have access to the `app` instance, you can retrieve the global config object directly:

```python
# Accessing global settings
app_name = app.config.name
is_debug = app.config.debug
```

### 2. Using the Config Facade
The `Config` facade allows you to retrieve values from any registered configuration using a "dotted" path. This is especially useful for accessing configurations registered by different service providers (like database or logging).

```python
from fastapi_startkit.facades import Config

# Accessing global app config
app_name = Config.get("app.name")

# Accessing other configurations (e.g., from DatabaseProvider)
db_host = Config.get("database.connections.postgres.host")

# Providing a default value
secret = Config.get("services.stripe.secret", "default_secret")
```

### 3. Registering Custom Configs
Service providers can merge their own configurations into the global config pool:

```python
class RedisProvider(Provider):
    def register(self):
        from config.redis import config
        # Merges config into the 'redis' namespace
        self.merge_config_from(config, "redis")
```
