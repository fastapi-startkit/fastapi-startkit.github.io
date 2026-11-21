---
outline: deep
title: Notifications
description: Notify users over mail, the database, real-time broadcasts, or your own channels from a single Notification class in FastAPI Startkit, with a Notifiable model mixin and on-demand routing.
keywords: notifications, notifiable, mail notifications, database notifications, broadcast notifications, laravel echo, channels, fastapi, fastapi-startkit
---

# Notifications

## Introduction

Notifications are short messages that tell your users something happened in your application, such as an invoice being paid or a password being changed. You describe a notification once in a class, and the framework delivers it over each channel the notification asks for:

| Channel | What it does |
|---|---|
| `mail` | Sends an email through [Mail](/docs/mail) |
| `database` | Stores the notification in a `notifications` table so your UI can list it |
| `broadcast` | Pushes the notification to the browser in real time through [Broadcasting](/docs/broadcasting) |

You can add your own channels, such as SMS or Slack, with [`extend()`](#custom-channels).

- [Configuration](#configuration)
- [Creating Notifications](#creating-notifications)
- [Sending Notifications](#sending-notifications)
- [Mail Notifications](#mail-notifications)
- [Database Notifications](#database-notifications)
- [Broadcast Notifications](#broadcast-notifications)
- [Custom Channels](#custom-channels)
- [Testing Notifications](#testing-notifications)

## Configuration

Register `NotificationProvider` in `bootstrap/application.py`, along with the provider each of your channels needs: [`MailProvider`](/docs/mail) for `mail`, [`DatabaseProvider`](/docs/database/) for `database`, and [`ReverbProvider`](/docs/broadcasting) for `broadcast`:

```python
# bootstrap/application.py
from pathlib import Path

from config.database import DatabaseConfig
from fastapi_startkit.application import Application
from fastapi_startkit.mail import MailProvider
from fastapi_startkit.masoniteorm import DatabaseProvider
from fastapi_startkit.notifications import NotificationProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        (DatabaseProvider, DatabaseConfig),
        MailProvider,
        NotificationProvider,
    ],
)
```

Sending over a channel whose provider is missing raises a `RuntimeError`, for example `Notifications through [mail] require MailProvider to be registered.`

| Variable | Default | Description |
|---|---|---|
| `NOTIFICATIONS_TABLE` | `notifications` | Table the `database` channel writes to |
| `DB_NOTIFICATIONS_CONNECTION` | — | Database connection for that table; the default connection when unset |

### The Notifications Table

Publish the config file and the migration that creates the table, then run it:

```bash
uv run python artisan provider:publish --provider=notifications
uv run python artisan db:migrate
```

This writes `config/notifications.py` and `databases/migrations/2026_11_06_000000_create_notifications_table.py`. The table has a string `id`, the notification `type`, `notifiable_type` and `notifiable_id`, a `data` text column holding JSON, a nullable `read_at`, and timestamps.

## Creating Notifications

### Generating Notifications

Run `make:notification` to write a notification class into `app/notifications`:

```bash
uv run python artisan make:notification InvoicePaid
```

This creates `app/notifications/invoice_paid.py` with `via()`, `to_mail()` and `to_array()` methods to fill in. Pass `-d` to write somewhere else, for example `-d src/notifications`. The command won't overwrite an existing file.

### Writing Notifications

A notification subclasses `Notification` from `fastapi_startkit.notifications`. `via()` returns the channels to deliver on, and each channel calls the matching `to_<channel>()` method:

```python
# app/notifications/invoice_paid.py
from fastapi_startkit.notifications import AnonymousNotifiable, MailMessage, Notification


class InvoicePaid(Notification):
    def __init__(self, invoice):
        self.invoice = invoice

    def via(self, notifiable):
        if isinstance(notifiable, AnonymousNotifiable):
            return ["mail"]
        return ["mail", "database"]

    def to_mail(self, notifiable):
        return (
            MailMessage()
            .subject("Invoice paid")
            .greeting(f"Hello {getattr(notifiable, 'name', 'there')}")
            .line(f"We received your payment of {self.invoice.amount}.")
            .action("View invoice", f"https://example.com/invoices/{self.invoice.id}")
            .salutation("Thanks!")
        )

    def to_array(self, notifiable):
        return {"invoice_id": self.invoice.id, "amount": self.invoice.amount}
```

`via()` receives the recipient, so you can pick channels per recipient. Here an [on-demand recipient](#on-demand-notifications) only gets the email, because the `database` channel needs a model. A channel listed in `via()` without its `to_<channel>()` method raises a `NotificationException`, for example `Notification [InvoicePaid] has no to_mail() method.`

## Sending Notifications

### The Notifiable Mixin

Add `Notifiable` to a model to send it notifications with `notify()`:

```python
# app/models/user.py
from fastapi_startkit.masoniteorm import Model
from fastapi_startkit.notifications import Notifiable


class User(Model, Notifiable):
    __fillable__ = ["name", "email"]
```

```python
await user.notify(InvoicePaid(invoice))
```

### The Notification Facade

To notify several recipients at once, use the `Notification` facade. Each recipient gets its own notification id:

```python
from fastapi_startkit.facades import Notification

await Notification.send([ann, bob], InvoicePaid(invoice))
```

`Notification.send_now()` takes the same arguments and sends the same way as `send()`.

### On-Demand Notifications

To notify someone who isn't a model, such as a guest, give the route yourself with `Notification.route()`:

```python
from fastapi_startkit.facades import Notification

await Notification.route("mail", "guest@example.com").notify(InvoicePaid(invoice))
```

The notification's methods then receive an `AnonymousNotifiable`, which only holds the routes. It has no model attributes such as `name`, which is why `InvoicePaid.to_mail()` reads the name with `getattr()`. An on-demand recipient can't use the `database` channel; it raises `NotificationException: The database channel requires a Notifiable model.`

## Mail Notifications

`to_mail()` returns a `MailMessage`, or any other [`Mailable`](/docs/mail#writing-mailables). `MailMessage` is a `Mailable` that builds both a text and an HTML body from a few parts:

| Method | Description | Default |
|---|---|---|
| `greeting(text)` | The opening line, an `<h1>` in HTML | `Hello!` |
| `line(text)` | Adds a paragraph; call it once per paragraph | — |
| `action(text, url)` | Adds a link, written as `text: url` in the text body | — |
| `salutation(text)` | The closing line | `Regards` |

The `InvoicePaid` example above produces this text body:

```text
Hello Ann

We received your payment of $49.00.

View invoice: https://example.com/invoices/12

Thanks!
```

Every value is HTML-escaped in the HTML body. Since `MailMessage` is a `Mailable`, you can also call `subject()`, `cc()`, `attach()` and the other mailable methods, and `text()` or `html()` replace the generated body.

### Routing Mail

When the message has no `to()` recipients, the channel sends it to the notifiable's `email` attribute. To use another address, add a `route_notification_for_mail()` method. It can return anything `Mailable.to()` accepts:

```python
# app/models/user.py
class User(Model, Notifiable):
    def route_notification_for_mail(self, notification):
        return (self.billing_email, self.name)
```

When there's no address at all, the mail channel skips the notification. If `to_mail()` already set recipients with `to()`, the channel keeps them.

### Choosing a Mailer

Set `mailer` on the notification to send through a mailer other than the default. This example needs a reachable SMTP server:

```python
notification = InvoicePaid(invoice)
notification.mailer = "smtp"

await user.notify(notification)
```

## Database Notifications

The `database` channel stores the result of `to_database()` when the notification defines it, and `to_array()` otherwise. The result is saved as JSON in the `data` column, with the class name as `type`, the model's morph name as `notifiable_type`, and its primary key as `notifiable_id`.

Read a model's notifications, newest first, with `notifications()`:

```python
import json

rows = await user.notifications()

for row in rows:
    data = json.loads(row["data"])
    data["invoice_id"]  # 12
```

Each row is a dictionary of the table's columns, and `data` comes back as the stored JSON text.

### Read and Unread Notifications

A new notification has an empty `read_at`. Use these `Notifiable` methods to list and update read state:

| Method | Description |
|---|---|
| `await user.unread_notifications()` | Rows whose `read_at` is empty, newest first |
| `await user.read_notifications()` | Rows whose `read_at` is set, newest first |
| `await user.mark_notifications_as_read(*ids)` | Sets `read_at` to now on the given ids |
| `await user.mark_notifications_as_unread(*ids)` | Clears `read_at` on the given ids |
| `await user.mark_all_notifications_as_read()` | Sets `read_at` to now on all of the user's notifications |
| `await user.mark_all_notifications_as_unread()` | Clears `read_at` on all of the user's notifications |

```python
unread = await user.unread_notifications()
badge_count = len(unread)

await user.mark_notifications_as_read(unread[0]["id"])
await user.mark_all_notifications_as_read()
```

The mark methods return the number of updated rows and only touch the user's own notifications. Calling `mark_notifications_as_read()` or `mark_notifications_as_unread()` with no ids updates nothing and returns `0`; use the `mark_all_` methods to update everything. Marking as read skips rows that are already read, so `read_at` keeps the time they were first read.

## Broadcast Notifications

The `broadcast` channel sends the notification over [Broadcasting](/docs/broadcasting), so a page listening with Laravel Echo receives it right away. It sends the result of `to_broadcast()` when the notification defines it, and `to_array()` otherwise:

```python
# app/notifications/invoice_paid.py
class InvoicePaid(Notification):
    def via(self, notifiable):
        return ["database", "broadcast"]

    def to_broadcast(self, notifiable):
        return {"invoice_id": self.invoice.id, "amount": self.invoice.amount}
```

The channel adds the notification's `id` and `type` (the class name) to that payload, so the `id` matches the database row when you use both channels.

### Listening for Notifications

A model receives broadcasts on the private channel `{notifiable_type}.{id}`, for example `private-User.7`, where `notifiable_type` is the model's morph name. Authorize it like any other private channel in `routes/channels.py`:

```python
# routes/channels.py
from fastapi_startkit.broadcasting import channel


@channel("private-User.{user_id}")
async def user_channel(user, user_id: int):
    return user is not None and user.id == user_id
```

Then listen with Echo's `notification()` helper:

```js
Echo.private(`User.${userId}`).notification((notification) => {
    console.log(notification.type, notification.invoice_id)
})
```

The event is named `Illuminate\Notifications\Events\BroadcastNotificationCreated`, which is the name Echo's `notification()` listens for. Override `broadcast_as()` on the notification to send it under another event name, `broadcast_type()` to change the `type` field, and `receives_broadcast_notifications_on()` on the model to use another channel name.

### Customizing the Channel

Add `route_notification_for_broadcast()` to send to other channels. It can return a channel name, a `Channel` from `fastapi_startkit.broadcasting`, or a list of either. A plain string always gets the `private-` prefix, so `"teams.1"` is sent on `private-teams.1`; return a `Channel` or `PresenceChannel` to send on a public or presence channel:

```python
# app/models/user.py
from fastapi_startkit.broadcasting import PresenceChannel


class User(Model, Notifiable):
    def route_notification_for_broadcast(self, notification):
        return [f"teams.{self.team_id}", PresenceChannel("dashboard")]
```

On-demand recipients broadcast with `Notification.route("broadcast", "orders.9")`, which sends on `private-orders.9`. When there's no broadcast route, the channel skips the notification.

## Custom Channels

A channel is any class with an async `send(notifiable, notification)` method. Register it with `Notification.extend()`, passing a factory that builds the channel. Do this in a provider's `boot()` method:

```python
# app/providers/notification_service_provider.py
from fastapi_startkit.facades import Notification
from fastapi_startkit.support import Provider


class SmsChannel:
    async def send(self, notifiable, notification):
        message = notification.to_sms(notifiable)
        phone = notifiable.route_notification_for("sms", notification)
        ...  # send the message with your SMS provider


class NotificationServiceProvider(Provider):
    def boot(self):
        Notification.extend("sms", SmsChannel)
```

Then list `"sms"` in a notification's `via()` and add a `to_sms()` method. `route_notification_for("sms", notification)` calls the notifiable's `route_notification_for_sms()` method when it has one, and returns the notifiable itself otherwise. For an on-demand recipient it returns the route you passed, as in `Notification.route("sms", "+15550100")`.

## Testing Notifications

Set `MAIL_MAILER=array` in `.env.testing` to keep mail notifications in memory, and point the database at a test database. Then assert on the mailer's messages and the recipient's stored notifications:

```python
# tests/test_invoice_paid.py
import json
from types import SimpleNamespace

from fastapi_startkit.facades import Mail

from app.models.user import User
from app.notifications.invoice_paid import InvoicePaid


async def test_paying_an_invoice_notifies_the_user():
    user = await User.create({"name": "Ann", "email": "ann@example.com"})
    invoice = SimpleNamespace(id=12, amount="$49.00")

    await user.notify(InvoicePaid(invoice))

    message = Mail.mailer().transport.messages[-1]
    assert message["To"] == "ann@example.com"
    assert message["Subject"] == "Invoice paid"

    [row] = await user.unread_notifications()
    assert json.loads(row["data"]) == {"invoice_id": 12, "amount": "$49.00"}
```

See [Mail](/docs/mail#testing) for booting the application in tests and [Database Testing](/docs/testing/database) for resetting the database between tests.

## See Also

- [Mail](/docs/mail): mailers, mailables and the `array` mailer for tests
- [Broadcasting](/docs/broadcasting): Reverb, private channels and channel authorization
- [Migrations](/docs/database/migrations): running the notifications migration
