---
outline: deep
title: Mail
description: Send email from FastAPI Startkit with fluent Mailable classes, the Mail facade, and SMTP, log and in-memory array mailers.
keywords: mail, email, smtp, mailable, mail facade, attachments, fastapi, fastapi-startkit
---

# Mail

The framework sends email through a `Mailable` class with a fluent builder and a `Mail` facade that delivers it through one of your configured mailers. You describe a message once, and the mailer decides whether it goes to an SMTP server, to your logs or into memory for your tests.

Three drivers are available:

| Driver | What it does |
|---|---|
| `smtp` | Sends through an SMTP server without blocking the event loop |
| `log` | Writes a readable summary of each message to a Python logger instead of sending it |
| `array` | Keeps each message in memory so your tests can inspect it |

- [Configuration](#configuration)
- [Writing Mailables](#writing-mailables)
- [Sending Mail](#sending-mail)
- [Custom Drivers](#custom-drivers)
- [Testing](#testing)

## Configuration

Register `MailProvider` in `bootstrap/application.py`:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit.application import Application
from fastapi_startkit.mail import MailProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        MailProvider,
    ],
)
```

Then choose a mailer and give it its settings in `.env`. This example needs a real SMTP server:

```ini
# .env
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailgun.org
MAIL_PORT=587
MAIL_USERNAME=postmaster@example.com
MAIL_PASSWORD=secret
MAIL_ENCRYPTION=tls

MAIL_FROM_ADDRESS=hello@example.com
MAIL_FROM_NAME="Example"
```

| Variable | Default | Description |
|---|---|---|
| `MAIL_MAILER` | `log` | The default mailer: `smtp`, `log` or `array` |
| `MAIL_FROM_ADDRESS` | `hello@example.com` | Sender for messages that don't set one |
| `MAIL_FROM_NAME` | `Example` | Sender name |
| `MAIL_HOST` | `127.0.0.1` | SMTP host |
| `MAIL_PORT` | `587` | SMTP port |
| `MAIL_USERNAME` | — | SMTP username; the mailer only logs in when it is set |
| `MAIL_PASSWORD` | — | SMTP password |
| `MAIL_ENCRYPTION` | `tls` | `tls` upgrades the connection with STARTTLS and `ssl` connects over SSL; any other value, such as `none`, uses a plain connection |
| `MAIL_TIMEOUT` | `30` | SMTP timeout in seconds |
| `MAIL_LOG_CHANNEL` | — | Name of the Python logger the `log` driver writes to; `fastapi_startkit.mail` when unset |

The default mailer is `log`, so the application doesn't send real email until you set `MAIL_MAILER`. The `log` driver writes each summary at `INFO` level. When [`LogProvider`](/docs/logging) is registered, those records reach your default log channel.

### Publishing the Config File

To add or change mailers, publish the config to `config/mail.py`:

```bash
uv run python artisan provider:publish --provider=mail
```

The published file holds a `MailConfig` dataclass with one entry per mailer:

```python
# config/mail.py
@dataclass
class MailConfig(Config):
    default: str = env("MAIL_MAILER", "log")
    from_address: str = env("MAIL_FROM_ADDRESS", "hello@example.com")
    from_name: str = env("MAIL_FROM_NAME", "Example")
    mailers: dict[str, Config] = field(
        default_factory=lambda: {
            "smtp": SmtpMailerConfig(),
            "log": LogMailerConfig(),
            "array": ArrayMailerConfig(),
        }
    )
```

Pass it with the provider so the application uses it:

```python
# bootstrap/application.py
from config.mail import MailConfig
from fastapi_startkit.mail import MailProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        (MailProvider, MailConfig),
    ],
)
```

## Writing Mailables

Build a `Mailable` with chained methods. Every message needs at least one recipient and a subject:

```python
from fastapi_startkit.mail import Mailable

mailable = (
    Mailable()
    .to("ann@example.com", name="Ann")
    .cc("team@example.com")
    .subject("Your invoice")
    .text("Thanks for your order.")
    .html("<p>Thanks for your <strong>order</strong>.</p>")
    .attach("storage/invoices/1.pdf")
)
```

| Method | Description |
|---|---|
| `to(*addresses, name=None)` | Adds recipients |
| `cc(*addresses, name=None)` / `bcc(*addresses, name=None)` | Adds copy recipients |
| `reply_to(*addresses, name=None)` | Adds `Reply-To` addresses |
| `from_(address, name=None)` | Sets the sender, overriding `MAIL_FROM_ADDRESS` |
| `subject(subject)` | Sets the subject |
| `text(text)` / `html(html)` | Sets the plain text and HTML bodies |
| `attach(path, name=None, mime=None)` | Attaches a file from disk |
| `attach_data(data, name, mime=None)` | Attaches `bytes` or `str` content |

An address can be a string, an `(email, name)` tuple, or any object with an `email` attribute, such as your `User` model; its `name` attribute is used when present. You can pass several addresses at once, or a single list. The `name` argument only applies when you pass one address.

When a message has both bodies, the HTML is added as an alternative to the text. With only `html()`, the message is sent as HTML. When you don't give an attachment's MIME type, it is guessed from the file name.

Sending a mailable without a subject raises `ValueError: Mailable [Mailable] has no subject.`, and one without any `to`, `cc` or `bcc` address raises a similar `ValueError`.

### Mailable Classes

For an email you send from more than one place, subclass `Mailable` and set it up in `build()`. The mailer calls `build()` once, right before it compiles the message:

```python
# app/mail/order_shipped.py
from fastapi_startkit.mail import Mailable


class OrderShipped(Mailable):
    def __init__(self, order):
        super().__init__()
        self.order = order

    def build(self):
        return (
            self.subject(f"Order #{self.order.id} has shipped")
            .text(f"Your order is on its way. Tracking number: {self.order.tracking}")
        )
```

## Sending Mail

Send a mailable through the default mailer with the `Mail` facade. `send()` returns the `EmailMessage` that was delivered:

```python
from fastapi_startkit.facades import Mail

message = await Mail.send(OrderShipped(order).to(user))
message["Subject"]  # "Order #42 has shipped"
```

`Mail.to()` sets the recipients outside the mailable, and chains `cc()` and `bcc()`:

```python
await Mail.to(user).cc("sales@example.com").send(OrderShipped(order))
```

To send through a mailer other than the default, pick it by name:

```python
await Mail.mailer("log").send(OrderShipped(order).to(user))
```

A name that isn't in `mailers` raises `ValueError: Mailer [name] is not defined.`

## Custom Drivers

Register a driver with `Mail.extend()`. The factory receives the mailer's config dictionary and returns an object with an async `send(message)` method. Register it in a provider's `boot()` method:

```python
# app/providers/mail_service_provider.py
from email.message import EmailMessage

from fastapi_startkit.facades import Mail
from fastapi_startkit.support import Provider


class ApiTransport:
    def __init__(self, config):
        self.config = config

    async def send(self, message: EmailMessage) -> None:
        ...  # call your email service's HTTP API


class MailServiceProvider(Provider):
    def boot(self):
        Mail.extend("api", ApiTransport)
```

Then add a mailer that uses the driver to `mailers` in your published `config/mail.py`:

```python
# config/mail.py
mailers: dict[str, Config] = field(
    default_factory=lambda: {
        "smtp": SmtpMailerConfig(),
        "log": LogMailerConfig(),
        "array": ArrayMailerConfig(),
        "api": {"driver": "api"},
    }
)
```

Send through it with `Mail.mailer("api")`, or make it the default with `MAIL_MAILER=api`. Each mailer is built once and reused; `Mail.forget_mailers()` clears them so the next call builds them again.

## Testing

Set `MAIL_MAILER=array` in `.env.testing`. The application loads `.env.testing` when it boots inside a running test, so import it from a fixture rather than at the top of a test module:

```ini
# .env.testing
MAIL_MAILER=array
```

```python
# tests/conftest.py
import pytest


@pytest.fixture(autouse=True)
def app():
    from bootstrap.application import app

    return app
```

The `array` mailer's transport keeps every message it receives in `messages`, and `flush()` empties it:

```python
# tests/test_order_mail.py
from types import SimpleNamespace

from fastapi_startkit.facades import Mail

from app.mail.order_shipped import OrderShipped


async def test_order_shipped_mail():
    order = SimpleNamespace(id=42, tracking="1Z999")

    await Mail.send(OrderShipped(order).to("ann@example.com"))

    [message] = Mail.mailer().transport.messages
    assert message["To"] == "ann@example.com"
    assert message["Subject"] == "Order #42 has shipped"

    Mail.mailer().transport.flush()
```

See [FastAPI Testing](/docs/testing/fastapi) for the pytest settings these tests use.

See [Notifications](/docs/notifications) to send a message over mail and other channels from one class, and [Logging](/docs/logging) for where the `log` mailer's output ends up.
