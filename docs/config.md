### Environtment File
Startkit loads the `.env` file in base directory by default, and Additional Environment Files
Before loading your application's environment variables, Starter Kit determines if an APP_ENV environment variable has been externally provided or if the --env CLI argument has been specified. If so, Laravel will attempt to load an .env.[APP_ENV] file if it exists. If it does not exist, the default .env file will be loaded.

### Retrieving Environment Configuration
The environment variables cab be accessed from `.env`, but be careful to access it before loading into the application, so `Application` loads the environemnt when doing bootstrap.

example:
```python
import os

DATABASES = {
    "default": "postgres",
    "postgres": {
        "driver": "postgres",
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "database": os.getenv("DB_DATABASE", "local"),
        "user": os.getenv("DB_USERNAME", "local"),
        "password": os.getenv("DB_PASSWORD", "secret"),
        "port": os.getenv("DB_PORT", "5432"),
        "prefix": "",
        "options": {
            "min_size": 1,
            "max_size": 10,
        },
    },
}
```

The recommended way to access environment through out the application is to use the `Config` class provided by `fastapi_startkit.config` module, so that the application can access environment variables in a type-safe and consistent manner. To do so, consider registering config to the service provider, which is typically done through `ServiceProvider`, if you are making any new service make a new service provider
```python
class RedisServiceProvider(Provider):
    def register(self):
        from config.redis import config
        self.merge_config_from(config, "redis")
```

and then you can access the config with
```python
Config.get('redis.host')
Config.get('redis.database')
```

### Accessing Configuration Values
```python
from fastapi_startkit.config import Config

app = Config.get('app.timezone')
```
