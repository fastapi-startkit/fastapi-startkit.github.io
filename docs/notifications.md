---
outline: deep
title: Notifications
description: Notify users over mail, the database, real-time broadcasts, or your own channels from a single Notification class in FastAPI Startkit, with a Notifiable model mixin and on-demand routing.
keywords: notifications, notifiable, mail notifications, database notifications, broadcast notifications, laravel echo, channels, fastapi, fastapi-startkit
---

# Notifications

## Introduction

Some events deserve a heads-up: an invoice was paid, a password was changed, a report is ready. A notification describes that message once, and then delivers it over one or more channels. FastAPI Startkit ships three channels:

| Channel | What it does |
|---|---|
| `mail` | Sends an email through the [Mail](/docs/mail) system |
| `database` | Stores the notification in a `notifications` table, so your UI can list it |
| `broadcast` | Pushes the notification to the browser in real time through [Broadcasting](/docs/broadcasting) |

You can add your own channels, such as SMS or Slack, with [`extend()`](#custom-channels).

## Configuration

Register `NotificationProvider` in `bootstrap/application.py`. The `mail` channel needs [`MailProvider`](/docs/mail), the `database` channel needs [`DatabaseProvider`](/docs/database/) and the `broadcast` channel needs [`ReverbProvider`](/docs/broadcasting), so register the ones for the channels you use:

```python
# bootstrap/application.py
from fastapi_startkit.mail import MailProvider
from fastapi_startkit.masoniteorm import DatabaseProvider
from fastapi_startkit.notifications import NotificationProvider

from config.database import DatabaseConfig

app = Application(
    base_path=...,
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

### The notifications table

Publish the config file and the migration that creates the table, then run it:

```bash
uv run python artisan provider:publish --provider=notifications
uv run python artisan db:migrate
```

This writes `config/notifications.py` and `databases/migrations/2026_11_06_000000_create_notifications_table.py`. The table has a string `id`, the notification `type`, `notifiable_type` and `notifiable_id`, a `data` text column holding JSON, a nullable `read_at`, and timestamps.

## Creating Notifications

### Generating notifications

`NotificationProvider` registers a generator that writes a notification class into `app/notifications`:

```bash
uv run python artisan make:notification InvoicePaid
```

This creates `app/notifications/invoice_paid.py` with `via()`, `to_mail()` and `to_array()` methods to fill in. Pass `-d` to write somewhere else, for example `-d src/notifications`. The command refuses to overwrite an existing file.

### Writing notifications

A notification subclasses `Notification`. `via()` returns the channels to deliver on, and each channel calls the matching `to_<channel>()` method:

```python
from fastapi_startkit.notifications import MailMessage, Notification


class InvoicePaid(Notification):
    def __init__(self, invoice):
        self.invoice = invoice

    def via(self, notifiable):
        return ["mail", "database"]

    def to_mail(self, notifiable):
        return (
            MailMessage()
            .subject("Invoice paid")
            .greeting(f"Hello {notifiable.name}")
            .line(f"We received your payment of {self.invoice.amount}.")
            .action("View invoice", f"https://example.com/invoices/{self.invoice.id}")
            .salutation("Thanks!")
        )

    def to_array(self, notifiable):
        return {"invoice_id": self.invoice.id, "amount": self.invoice.amount}
```

`via()` receives the recipient, so you can pick channels per user. A channel listed in `via()` without its `to_<channel>()` method raises a `NotificationException`.

## Sending Notifications

### The `Notifiable` mixin

Add `Notifiable` to a model to send it notifications with `notify()`:

```python
from fastapi_startkit.masoniteorm import Model
from fastapi_startkit.notifications import Notifiable


class User(Model, Notifiable):
    pass
```

```python
await user.notify(InvoicePaid(invoice))
```

To notify several recipients at once, use the `Notification` facade. Each recipient gets its own notification id:

```python
from fastapi_startkit.facades import Notification as Notify

await Notify.send([ann, bob], InvoicePaid(invoice))
```

`Notify.send_now()` is an alias of `send()` until a queue exists. FastAPI Startkit has no built-in queue, so notifications are always sent right away; `send_now()` exists so code ported from Laravel keeps working.

The facade has the same name as the `Notification` base class, so import one of them under another name when a module needs both.

### On-demand notifications

To notify someone who isn't a model, such as a guest, give the route yourself:

```python
await Notify.route("mail", "guest@example.com").notify(InvoicePaid(invoice))
```

The notification's methods then receive an `AnonymousNotifiable`, which only holds the routes. It has no model attributes such as `name`, so a `to_mail()` that reads them, like the `InvoicePaid` example above, needs a fallback such as `getattr(notifiable, "name", "there")`. An on-demand recipient can only use channels that don't need a model; the `database` channel raises a `NotificationException`.

## Mail Notifications

`to_mail()` returns a `MailMessage`, or any other [`Mailable`](/docs/mail#writing-mailables). `MailMessage` is a `Mailable` that builds both a text and an HTML body from a few parts:

| Method | Description | Default |
|---|---|---|
| `greeting(text)` | The opening line, an `<h1>` in HTML | `Hello!` |
| `line(text)` | Adds a paragraph; call it once per paragraph | — |
| `action(text, url)` | Adds a link, written as `text: url` in the text body | — |
| `salutation(text)` | The closing line | `Regards` |

Every value is HTML-escaped in the HTML body. Because it is a `Mailable`, you can also call `subject()`, `cc()`, `attach()` and the other mailable methods, and `text()` or `html()` replace the generated body.

### Routing mail

When the message has no `to()` recipients, the channel sends it to the notifiable's `email` attribute. To use another address, add a `route_notification_for_mail()` method. It can return anything `Mailable.to()` accepts:

```python
class User(Model, Notifiable):
    def route_notification_for_mail(self, notification):
        return (self.billing_email, self.name)
```

When there's no address at all, the mail channel skips the notification. If `to_mail()` already set recipients with `to()`, they are kept.

### Choosing a mailer

Set `mailer` on the notification to send through a mailer other than the default:

```python
notification = InvoicePaid(invoice)
notification.mailer = "smtp"

await user.notify(notification)
```

## Database Notifications

The `database` channel stores `to_database()` when the notification defines it, and `to_array()` otherwise. The result is saved as JSON in the `data` column, with the class name as `type`, the model's morph name as `notifiable_type`, and its primary key as `notifiable_id`.

Read a model's notifications, newest first, with `notifications()`:

```python
import json

rows = await user.notifications()

for row in rows:
    data = json.loads(row["data"])
```

Each row is a dictionary of the table's columns, and `data` comes back as the stored JSON text.

### Read and unread notifications

A new notification has an empty `read_at`. Use these `Notifiable` methods to list and update read state:

| Method | Description |
|---|---|
| `await user.unread_notifications()` | Rows whose `read_at` is empty, newest first |
| `await user.read_notifications()` | Rows whose `read_at` is set, newest first |
| `await user.mark_notifications_as_read(*ids)` | Sets `read_at` to now on the given ids, or on all of the user's notifications when no id is given |
| `await user.mark_notifications_as_unread(*ids)` | Clears `read_at` on the given ids, or on all of them |

```python
unread = await user.unread_notifications()
badge_count = len(unread)

await user.mark_notifications_as_read(unread[0]["id"])
await user.mark_notifications_as_read()
```

Both mark methods return the number of updated rows and only touch the user's own notifications. `mark_notifications_as_read()` leaves rows that are already read alone, so `read_at` keeps the time they were first read.

## Broadcast Notifications

The `broadcast` channel sends the notification over [Broadcasting](/docs/broadcasting), so a page listening with Laravel Echo gets it immediately. It sends `to_broadcast()` when the notification defines it, and `to_array()` otherwise:

```python
class InvoicePaid(Notification):
    def via(self, notifiable):
        return ["database", "broadcast"]

    def to_broadcast(self, notifiable):
        return {"invoice_id": self.invoice.id, "amount": self.invoice.amount}
```

The channel adds the notification's `id` and `type` (the class name) to that payload, so the `id` matches the database row when you use both channels.

### Listening for notifications

By default a model receives broadcasts on the private channel `{notifiable_type}.{id}`, for example `private-User.7`. Authorize it like any other private channel, then listen with Echo's `notification()` helper:

```python
from fastapi_startkit.broadcasting import channel


@channel("private-User.{user_id}")
async def user_channel(user, user_id: int):
    return user is not None and user.id == user_id
```

```js
Echo.private(`User.${userId}`).notification((notification) => {
    console.log(notification.type, notification.invoice_id)
})
```

The event is named `Illuminate\Notifications\Events\BroadcastNotificationCreated`, which is the name Echo's `notification()` listens for. Override `broadcast_as()` on the notification to send it under another event name, and `broadcast_type()` to change the `type` field.

### Customizing the channel

Add `route_notification_for_broadcast()` to send to other channels. It can return a channel name, a `Channel` from `fastapi_startkit.broadcasting`, or a list of either. A plain string always gets the `private-` prefix, so `"teams.1"` is sent on `private-teams.1`; return a `Channel` or `PresenceChannel` to send on a public or presence channel:

```python
from fastapi_startkit.broadcasting import PresenceChannel


class User(Model, Notifiable):
    def route_notification_for_broadcast(self, notification):
        return [f"teams.{self.team_id}", PresenceChannel("dashboard")]
```

On-demand recipients broadcast with `Notify.route("broadcast", "orders.9")`, which sends on `private-orders.9`. When there's no broadcast route, the channel skips the notification.

## Custom Channels

A channel is any class with an async `send(notifiable, notification)` method. Register it with `extend()`, passing a factory that builds the channel:

```python
from fastapi_startkit.facades import Notification as Notify


class SmsChannel:
    async def send(self, notifiable, notification):
        message = notification.to_sms(notifiable)
        ...  # send it with your SMS provider


Notify.extend("sms", SmsChannel)
```

Then list `"sms"` in a notification's `via()` and add a `to_sms()` method. For your own channels, `notifiable.route_notification_for("sms", notification)` calls a `route_notification_for_sms()` method when the notifiable has one.

## See Also

- [Mail](/docs/mail): mailers, mailables and the `array` mailer for tests
- [Broadcasting](/docs/broadcasting): Reverb, private channels and channel authorization
- [Migrations](/docs/database/migrations): running the notifications migration
