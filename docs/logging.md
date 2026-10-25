---
outline: deep
title: Logging
description: Configure log channels and drivers, and write logs with the Logger facade.
keywords: logging, monitoring, debugging, fastapi
---

# Logging

When something goes wrong in your application, good logs are usually the first place you look. FastAPI Startkit gives you a logging system that can write messages to a file, the terminal, Slack, or syslog, and you choose where each message goes through configuration rather than code.

Logging is organised into channels. Each channel uses a driver, and the driver decides where its messages end up.

> [!NOTE]
> This logging system is based on [Masonite Logging](https://docs.masoniteproject.com/v3.0/official-packages/masonite-logging). Credit to the Masonite team for its design.

## Setup

To get started, register `LogProvider` in your application:

```python
# bootstrap/application.py
from fastapi_startkit import Application
from fastapi_startkit.logging import LogProvider

app: Application = Application(
    base_path=...,
    providers=[
        LogProvider,
        # ... other providers
    ]
)
```

## Usage

You write logs through the `Logger` facade. Each entry records the file and line number it came from, so you can always trace a message back to its source.

```python
from fastapi_startkit.logging import Logger

Logger.debug("This is a debug message")
Logger.info("Application is starting...")
Logger.notice("A formal notice")
Logger.warning("Unusual activity detected")
Logger.error("An error occurred during processing")
Logger.critical("System failure!")
Logger.alert("Immediate action required")
Logger.emergency("System is unusable")
```

## Configuration

You can configure logging inline in the providers list or in a dedicated config file. Which one you pick mostly depends on the size of your application.

### Way 1: Inline Configuration

For a small setup, pass a dictionary along with the provider:

```python
# bootstrap/application.py
from fastapi_startkit.logging import LogProvider

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

As your application grows, you'll want the settings in their own config file. Publish the default config to `config/logging.py`:

```bash
uv run python artisan provider:publish --provider=logging
```

The published file looks like this:

```python
import dataclasses

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env
from fastapi_startkit.logging.config import StackChannel, DailyChannel, TerminalChannel


@dataclasses.dataclass
class LoggingConfig(Config):
    default: str = env('LOG_CHANNEL', 'stack')
    level: str = env('LOG_LEVEL', 'info')

    channels: dict = dataclasses.field(default_factory=lambda: {
        'stack': StackChannel(
            driver='stack',
            channels=['daily', 'terminal']
        ),
        'daily': DailyChannel(
            level=env('LOG_DAILY_LEVEL', 'debug'),
            path=env('LOG_DAILY_PATH', 'storage/logs'),
        ),
        'terminal': TerminalChannel(
            level=env('LOG_TERMINAL_LEVEL', 'info'),
        ),
    })
```

> [!WARNING]
> `LogProvider` doesn't load `config/logging.py` on its own. You need to pass the class with the provider as a tuple.

```python
# bootstrap/application.py
from config.logging import LoggingConfig
from fastapi_startkit.logging import LogProvider

app = Application(
    base_path=...,
    providers=[
        # ... other providers
        (LogProvider, LoggingConfig),
    ]
)
```

`default` is the channel the `Logger` facade writes to. It reads `LOG_CHANNEL` and falls back to `stack`.

`channels` maps each channel name to a channel config class:

| Channel | Class | Behaviour | Environment variables |
|---|---|---|---|
| `stack` | `StackChannel` | Sends each message to `daily` and `terminal` | — |
| `daily` | `DailyChannel` | Writes to a new file each day | `LOG_DAILY_LEVEL`, `LOG_DAILY_PATH` |
| `terminal` | `TerminalChannel` | Prints to the console | `LOG_TERMINAL_LEVEL` |

## Available Drivers

Each channel's driver determines where its messages go and which options it accepts.

### `single`
Writes every message to one file.
- `path`: the log file.
- `level`: minimum level.

### `daily`
Writes to one file per day, such as `2023-10-27.log`.
- `path`: the directory for the log files.
- `level`: minimum level.

### `terminal`
Prints to the console, which is handy during development.
- `level`: minimum level.

### `stack`
Sends each message to several channels.
- `channels`: the channel names to include.

### `slack`
Posts messages to a Slack channel.
- `token`: your Slack bot token.
- `channel`: the Slack channel, such as `#logs`.
- `emoji`: the bot's icon emoji.
- `username`: the bot's username.
- `level`: minimum level.

### `syslog`
Sends messages to the system logger.
- `path`: the syslog socket, usually `/dev/log` or `/var/run/syslog`.
- `level`: minimum level.
