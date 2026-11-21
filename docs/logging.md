---
outline: deep
title: Logging
description: Configure log channels and write logs with the Log facade.
keywords: logging, monitoring, debugging, fastapi
---

# Logging

Logs tell you what your application did and what went wrong. The framework writes log messages to files, the terminal or Slack, and you choose where each message goes in configuration rather than in your code.

Logging is organised into channels. Each channel writes messages somewhere, such as a daily file or the terminal, and drops messages below its minimum level.

- [Configuration](#configuration)
- [Writing Log Messages](#writing-log-messages)
- [Log Levels](#log-levels)
- [Available Channels](#available-channels)
- [Forwarding Standard Library Logs](#forwarding-standard-library-logs)
- [Changing the Timezone](#changing-the-timezone)

## Configuration

To start logging, register `LogProvider` in your application. Without any configuration, it sends every message to a `stack` channel that writes to a daily file and to the terminal:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.logging import LogProvider

app = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        LogProvider,
    ],
)
```

### Publishing the Config File

To change the channels, publish the default configuration to `config/logging.py`:

```bash
uv run python artisan provider:publish --provider=logging
```

The published file looks like this:

```python
# config/logging.py
from dataclasses import field
from fastapi_startkit.configuration import Config
import dataclasses

from fastapi_startkit.environment import env
from fastapi_startkit.logging.config import StackChannel, DailyChannel, TerminalChannel


@dataclasses.dataclass
class LoggingConfig(Config):
    default: str = env("LOG_CHANNEL", "stack")
    level: str = env("LOG_LEVEL", "info")

    channels: dict[str, Config] = field(
        default_factory=lambda: {
            "stack": StackChannel(driver="stack", channels=["daily", "terminal"]),
            "daily": DailyChannel(
                level=env("LOG_DAILY_LEVEL", "debug"),
                path=env("LOG_DAILY_PATH", "storage/logs"),
            ),
            "terminal": TerminalChannel(
                level=env("LOG_TERMINAL_LEVEL", "info"),
            ),
        }
    )
```

`LogProvider` doesn't read this file on its own. Pass the class with the provider as a tuple:

```python
# bootstrap/application.py
from config.logging import LoggingConfig
from fastapi_startkit.logging import LogProvider

app = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        (LogProvider, LoggingConfig),
    ],
)
```

The configuration has three keys:

| Key | Environment variable | Description |
|---|---|---|
| `default` | `LOG_CHANNEL` | The channel the `Log` facade writes to. Defaults to `stack`. |
| `level` | `LOG_LEVEL` | The level of Python's root logger, which decides which standard library records are forwarded. Defaults to `info`. See [Forwarding Standard Library Logs](#forwarding-standard-library-logs). |
| `channels` | | The settings for each channel, keyed by channel name. See [Available Channels](#available-channels). |

### Inline Configuration

For a small application, you can pass a dictionary with the provider instead of a config file:

```python
# bootstrap/application.py
app = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        (LogProvider, {
            "default": "stack",
            "channels": {
                "stack": {"driver": "stack", "channels": ["daily", "terminal"]},
                "daily": {"driver": "daily", "level": "debug", "path": "storage/logs"},
                "terminal": {"driver": "terminal", "level": "info"},
            },
        }),
    ],
)
```

Each top-level key you pass replaces the default for that key, so a `channels` dictionary must list every channel you use.

## Writing Log Messages

Write log messages with the `Log` facade. There's a method for each level:

```python
from fastapi_startkit.logging import Log

Log.emergency("The database is unreachable")
Log.alert("Disk usage is above 95%")
Log.critical("The payment provider is down")
Log.error(f"Payment failed for order {order.id}")
Log.warning("Payment retry scheduled")
Log.notice("Nightly report generated")
Log.info(f"Order {order.id} placed by {user.email}")
Log.debug("Cache warmed")
```

When the level is only known at runtime, pass it to `Log.log()`:

```python
Log.log("warning", "Payment retry scheduled")
```

Each message you write with `Log` records the file and line it came from, so you can trace it back to your code:

```text
2026-11-21 06:04:28 - ERROR - /srv/shop/app/http/controllers/checkout_controller.py:42 - Payment failed for order 1042
```

`Logger` is a deprecated alias of `Log`. Importing it from `fastapi_startkit.logging` emits a `DeprecationWarning`, so import `Log` instead.

## Log Levels

Each channel has a `level` option that sets the least severe message it accepts. From most to least severe, the levels are:

`emergency`, `alert`, `critical`, `error`, `warning`, `notice`, `info`, `debug`

A channel with `level="warning"` writes `warning`, `error`, `critical`, `alert` and `emergency` messages, and drops `notice`, `info` and `debug` messages. In the published config, the daily file receives every message, while the terminal only shows `info` and above.

## Available Channels

Each entry in `channels` configures one channel. The channel names are fixed: `single`, `daily`, `terminal`, `stack` and `slack`. Each name has a config class in `fastapi_startkit.logging.config`.

::: warning
Use these exact names as keys. A `default` channel with any other name raises `ValueError: Logging channel '...' is not registered.`, and a `stack` silently skips names it doesn't know.
:::

| Channel | Config class | Writes to |
|---|---|---|
| `single` | `SingleChannel` | One log file |
| `daily` | `DailyChannel` | One log file named after the start date |
| `terminal` | `TerminalChannel` | Standard output |
| `stack` | `StackChannel` | Several other channels |
| `slack` | `SlackChannel` | A Slack channel |

Relative paths are resolved from the directory you start the application in.

### Single

The `single` channel appends every message to one file.

| Option | Default | Description |
|---|---|---|
| `path` | `storage/logs/single.log` | The log file. |
| `level` | `debug` | The minimum level. |

### Daily

The `daily` channel writes to a file named after the date the application started, such as `storage/logs/2026-11-21.log`. The name is fixed for the life of the process, so a process that runs past midnight keeps writing to the same file. Restart the application to start a new file.

| Option | Default | Description |
|---|---|---|
| `path` | `storage/logs` | The directory for the log files. |
| `level` | `debug` | The minimum level. |

### Terminal

The `terminal` channel prints each message to standard output, which is useful during development.

| Option | Default | Description |
|---|---|---|
| `level` | `info` | The minimum level. |

### Stack

The `stack` channel sends each message to several channels. Each channel in the stack applies its own `level`.

| Option | Default | Description |
|---|---|---|
| `channels` | `["daily", "terminal"]` | The names of the channels to send to. |

### Slack

The `slack` channel posts messages to Slack through the [`chat.postMessage`](https://api.slack.com/methods/chat.postMessage) API. Create a Slack app with a bot token that has the `chat:write` scope, invite the bot to your channel, and add the channel to your stack:

```python
# config/logging.py
from dataclasses import field
import dataclasses

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env
from fastapi_startkit.logging.config import DailyChannel, SlackChannel, StackChannel, TerminalChannel


@dataclasses.dataclass
class LoggingConfig(Config):
    default: str = env("LOG_CHANNEL", "stack")
    level: str = env("LOG_LEVEL", "info")

    channels: dict[str, Config] = field(
        default_factory=lambda: {
            "stack": StackChannel(channels=["daily", "terminal", "slack"]),
            "daily": DailyChannel(),
            "terminal": TerminalChannel(),
            "slack": SlackChannel(
                channel="#alerts",
                token=env("SLACK_TOKEN"),
                level="error",
            ),
        }
    )
```

Only `error` messages and above now reach Slack, while the daily file and the terminal keep receiving everything else.

| Option | Default | Description |
|---|---|---|
| `token` | `None` | Your bot token. |
| `channel` | `#bot` | The channel name, such as `#alerts`, or a channel ID. |
| `username` | `Logging Bot` | The name the bot posts as. |
| `emoji` | `:warning:` | The bot's icon emoji. |
| `level` | `debug` | The minimum level. |

A failure to reach Slack never breaks your application. When the token isn't set, the request fails or times out after 10 seconds, or Slack returns an error such as `channel_not_found`, the channel prints the reason to stderr instead of raising, and the other channels in the stack still receive the message:

```text
Slack log driver: token is not configured, message skipped
```

When Slack answers `429 Too Many Requests`, the channel drops messages until the `Retry-After` period has passed, or for 30 seconds when the header is missing.

## Forwarding Standard Library Logs

`LogProvider` also forwards records from Python's standard `logging` module to your default channel, so messages from libraries such as HTTPX end up in the same place as your own. Forwarding works when `default` is `terminal`:

```python
# bootstrap/application.py
app = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        (LogProvider, {
            "default": "terminal",
            "channels": {
                "terminal": {"driver": "terminal", "level": "info"},
            },
        }),
    ],
)
```

A record logged through the standard library now appears in the terminal:

```python
import logging

logging.getLogger("billing").warning("Invoice 1042 is overdue")
```

```text
2026-11-21 06:28:47 - WARNING - /srv/shop/.venv/lib/python3.12/site-packages/fastapi_startkit/logging/handler.py:11 - Invoice 1042 is overdue
```

Forwarded records always show `fastapi_startkit/logging/handler.py:11` as their source, not the line that logged them.

::: warning
Forwarding only works when `default` is `terminal`. With `stack`, `daily` or `single` as the default, including the published config, the first forwarded record is written to the log file twice, and records logged after your first `Log` call are no longer forwarded: they skip the other channels and go straight to the log file, labelled with the level of your last `Log` call.
:::

A forwarded record passes two level checks. The top-level `level` key, set with `LOG_LEVEL`, sets the level of Python's root logger, and records below it are never forwarded. The record then goes through the default channel's own `level`. To forward `debug` records, set both to `debug`:

```python
# bootstrap/application.py
(LogProvider, {
    "default": "terminal",
    "level": "debug",
    "channels": {
        "terminal": {"driver": "terminal", "level": "debug"},
    },
}),
```

## Changing the Timezone

Log timestamps and the names of daily files use UTC. To use another timezone, add a `timezone` entry to `channels` in `config/logging.py`:

```python
# config/logging.py
channels: dict[str, Config] = field(
    default_factory=lambda: {
        "timezone": "America/New_York",
        "stack": StackChannel(channels=["daily", "terminal"]),
        "daily": DailyChannel(),
        "terminal": TerminalChannel(),
    }
)
```

The value is any IANA timezone name.

See [Exception Handling](/docs/exception-handling) for how unhandled exceptions are written to the log.
