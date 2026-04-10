---
outline: deep
title: Logging
---

# Logging

Fastapi Startkit provides a powerful, modular, and Laravel-inspired logging system. It is built upon the concepts of **Drivers** and **Channels**, allowing you to easily route logs to files, terminal, Slack, or other services.

> [!NOTE]
> This logging system is based on [Masonite Logging](https://docs.masoniteproject.com/v3.0/official-packages/masonite-logging). We give full credit to the Masonite team for the architecture and design patterns used here.

## Setup


To enable logging in your application, you need to register the `LogProvider` in your application's bootstrap process.

```python
# bootstrap/application.py
from fastapi_startkit.application import Application
from fastapi_startkit.logging.providers import LogProvider

app: Application = Application(
    base_path=...,
    providers=[
        LogProvider,
        # ... other providers
    ]
)
```

## Usage

Fastapi Startkit configures Python's global logging system. Once the `LogProvider` is booted, you can use the standard Python `logging` module throughout your application.

```python
import logging

# Get a logger instance
logger = logging.getLogger(__name__)

# Log messages
logger.debug("This is a debug message")
logger.info("Application is starting...")
logger.warning("Unusual activity detected")
logger.error("An error occurred during processing")
logger.critical("System failure!")
```

## Configuration

There are two ways to configure your logging system: **Inline** (within the providers list) or via a **Dedicated Config File**.

### Way 1: Inline Configuration

For simple setups or when you want to keep configuration close to the application initialization, you can pass a configuration dictionary directly to the `LogProvider`.

```python
# bootstrap/application.py
from fastapi_startkit.logging.providers import LogProvider

app: Application = Application(
    base_path=...,
    providers=[
        (LogProvider, {
            'default': 'stack',
            'channels': {
                'stack': {
                    'driver': 'stack',
                    'channels': ['daily', 'terminal']
                },
                'daily': {
                    'driver': 'daily',
                    'level': 'debug',
                    'path': 'storage/logs'
                },
                'terminal': {
                    'driver': 'terminal',
                    'level': 'info',
                },
            },
        }),
    ]
)
```

### Way 2: Config File (Recommended)

For more complex applications, it is recommended to use a dedicated configuration file at `config/logging.py`. The `LogProvider` will automatically look for this file.

```python
# config/logging.py
from fastapi_startkit.environment import env

DEFAULT = env('LOG_CHANNEL', 'single')

CHANNELS = {
    'single': {
        'driver': 'single',
        'level': 'debug',
        'path': 'storage/logs/single.log'
    },
    'daily': {
        'driver': 'daily',
        'level': 'debug',
        'path': 'storage/logs'
    },
    'terminal': {
        'driver': 'terminal',
        'level': 'info',
    },
    'stack': {
        'driver': 'stack',
        'channels': ['single', 'terminal']
    }
}
```

## Available Drivers

Fastapi Startkit comes with several built-in drivers:

### `single`
Logs all messages to a single file.
- `path`: The path to the log file.
- `level`: Minimum logging level.

### `daily`
Logs messages to daily rotating files (e.g., `2023-10-27.log`).
- `path`: The directory where log files should be stored.
- `level`: Minimum logging level.

### `terminal`
Outputs logs directly to the console/stderr. Useful for development.
- `level`: Minimum logging level.

### `stack`
Allows you to combine multiple channels into a single logging stack.
- `channels`: A list of channel names to include in the stack.

### `slack`
Sends log messages to a Slack channel via a webhook/token.
- `token`: Your Slack Bot token.
- `channel`: The Slack channel name (e.g., `#logs`).
- `emoji`: Emoji to use for the bot icon.
- `username`: The username for the bot.
- `level`: Minimum logging level.

### `syslog`
Sends logs to the system logger.
- `path`: The syslog path (usually `/dev/log` or `/var/run/syslog`).
- `level`: Minimum logging level.

---


