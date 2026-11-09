---
outline: deep
title: Mail
description: Send email from FastAPI Startkit with fluent Mailable classes, the Mail facade, and SMTP, log and in-memory array mailers.
keywords: mail, email, smtp, mailable, mail facade, attachments, fastapi, fastapi-startkit
---

# Mail

## Introduction

Sending email shouldn't mean hand-building MIME messages in every controller. FastAPI Startkit gives you a `Mailable` class with a fluent builder, and a `Mail` facade that sends it through one of your configured mailers. A message is built once and compiled to a standard library `email.message.EmailMessage`, so there are no extra dependencies.

Three drivers are available:

| Driver | What it does |
|---|---|
| `smtp` | Sends through an SMTP server with Python's `smtplib`, run in a thread so it doesn't block the event loop |
| `log` | Writes a readable summary of each message to a log instead of sending it |
| `array` | Keeps each message in memory, which is handy in tests |

## Configuration

Register `MailProvider` in `bootstrap/application.py`. On its own it uses the default `MailConfig`, which reads the environment:

```python
# bootstrap/application.py
from fastapi_startkit.mail import MailProvider

app = Application(
    base_path=...,
    providers=[
        # ... other providers
        MailProvider,
    ],
)
```

Then set the mailer and its settings in `.env`:

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
| `MAIL_USERNAME` | — | SMTP username; the client only logs in when it is set |
| `MAIL_PASSWORD` | — | SMTP password |
| `MAIL_ENCRYPTION` | `tls` | `tls` upgrades the connection with STARTTLS, `ssl` connects over SSL; any other value, such as `none`, uses a plain connection |
| `MAIL_TIMEOUT` | `30` | SMTP timeout in seconds |
| `MAIL_LOG_CHANNEL` | — | Name of the Python logger the `log` driver writes to, `fastapi_startkit.mail` when unset |

Because the default mailer is `log`, a fresh application never sends real email until you set `MAIL_MAILER`. The `log` driver writes each summary at `INFO` level through Python's `logging` module. When [`LogProvider`](/docs/logging) is registered, those records are forwarded to your default log channel.

### Publishing the config file

To change the mailers themselves, publish the config to `config/mail.py`:

```bash
uv run python artisan provider:publish --provider=mail
```

The published file holds the `MailConfig` dataclass with one entry per mailer:

```python
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
    base_path=...,
    providers=[
        (MailProvider, MailConfig),
    ],
)
```

## Writing Mailables

A `Mailable` is built with chained methods. Every message needs at least one recipient and a subject:

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
| `reply_to(*addresses, name=None)` | Sets the `Reply-To` header |
| `from_(address, name=None)` | Sets the sender, overriding `MAIL_FROM_ADDRESS` |
| `subject(subject)` | Sets the subject |
| `text(text)` / `html(html)` | Sets the plain text and HTML bodies |
| `attach(path, name=None, mime=None)` | Attaches a file from disk |
| `attach_data(data, name, mime=None)` | Attaches `bytes` or `str` content |

An address can be a string, an `(email, name)` tuple, or any object with an `email` attribute, such as your `User` model, whose `name` attribute is used when present. You can pass several addresses at once, or a single list. `name` only applies when you pass one address.

When a message has both bodies, the HTML is added as an alternative to the text. With only `html()`, the message is sent as HTML. When the attachment type isn't given, it is guessed from the file name.

### Mailable classes

For an email you send from more than one place, subclass `Mailable` and set it up in `build()`. It runs once, right before the message is compiled:

```python
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

await Mail.send(OrderShipped(order).to(user))
```

`Mail.to()` sets the recipients outside the mailable, and also offers `cc()` and `bcc()`:

```python
await Mail.to(user).cc("sales@example.com").send(OrderShipped(order))
```

To send through a mailer other than the default, pick it by name:

```python
await Mail.mailer("smtp").send(OrderShipped(order).to(user))
```

A mailer that isn't in the config raises `ValueError: Mailer [name] is not defined.`

## Custom Drivers

Register a driver with `Mail.extend()`. The factory receives the mailer's config and returns an object with an async `send(message)` method:

```python
from email.message import EmailMessage

from fastapi_startkit.facades import Mail


class ApiTransport:
    def __init__(self, config):
        self.config = config

    async def send(self, message: EmailMessage) -> None:
        ...  # call your provider's HTTP API


Mail.extend("api", ApiTransport)
```

Then add a mailer that uses the driver to `mailers` in `config/mail.py`, for example `"api": {"driver": "api"}`. Mailers are created once and reused; `Mail.forget_mailers()` clears them so they are built again.

## Testing

Use the `array` mailer in tests, by setting `MAIL_MAILER=array` in `.env.testing`. Its transport keeps every message it receives:

```python
from fastapi_startkit.facades import Mail

await Mail.send(OrderShipped(order).to("ann@example.com"))

[message] = Mail.mailer().transport.messages
assert message["To"] == "ann@example.com"
assert message["Subject"] == f"Order #{order.id} has shipped"

Mail.mailer().transport.flush()
```

## See Also

- [Notifications](/docs/notifications): send a message over mail and other channels from one class
- [Logging](/docs/logging): where the `log` mailer's output ends up
