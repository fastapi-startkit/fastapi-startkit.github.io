---
outline: deep
title: Events
description: Define events and listeners, register them in an EventServiceProvider, dispatch them with the Event facade, and fake them in tests with FastAPI Startkit.
keywords: events, listeners, event dispatcher, event facade, event service provider, event fake, fastapi, fastapi-startkit
---

# Events

## Introduction

Events let one part of your application announce that something happened, and let other parts react to it without the two knowing about each other. For example, when an order ships, you might email the customer and write an audit log entry. Instead of calling both from your shipping code, you dispatch an `OrderShipped` event and register a listener for each task.

The event dispatcher is always available; the application registers it before your own providers. You talk to it through the `Event` facade.

- [Defining Events](#defining-events)
- [Defining Listeners](#defining-listeners)
- [Registering Events and Listeners](#registering-events-and-listeners)
- [Dispatching Events](#dispatching-events)
- [Framework Events](#framework-events)
- [Faking Events in Tests](#faking-events-in-tests)

## Defining Events

An event is a plain class that carries the data your listeners need. A dataclass works well:

```python
# app/events/order_shipped.py
from dataclasses import dataclass


@dataclass
class OrderShipped:
    order_id: int
    email: str
    tracking_number: str
```

Events don't extend a base class, and they have no behaviour of their own.

## Defining Listeners

A listener receives the event and does one job with it. It can be a class with a `handle()` method or a plain function, and either one can be sync or async.

A class listener can extend `Listener` from `fastapi_startkit.events`, which declares the `handle()` method:

```python
# app/listeners/send_shipment_notification.py
from fastapi_startkit.events import Listener
from fastapi_startkit.facades import Mail
from fastapi_startkit.mail import Mailable

from app.events.order_shipped import OrderShipped


class SendShipmentNotification(Listener):
    async def handle(self, event: OrderShipped):
        await Mail.send(
            Mailable()
            .to(event.email)
            .subject(f"Order #{event.order_id} has shipped")
            .text(f"Tracking number: {event.tracking_number}")
        )
```

A function listener takes the event as its only argument:

```python
# app/listeners/record_shipment.py
import logging

from app.events.order_shipped import OrderShipped

logger = logging.getLogger(__name__)


def record_shipment(event: OrderShipped):
    logger.info("Order %s shipped with %s", event.order_id, event.tracking_number)
```

The dispatcher builds a new instance of a class listener each time the event fires, through the service container. Type-hinted constructor arguments are resolved from the container:

```python
# app/listeners/notify_warehouse.py
from fastapi_startkit.mail import MailManager


class NotifyWarehouse:
    def __init__(self, mail: MailManager):
        self.mail = mail

    async def handle(self, event):
        ...
```

## Registering Events and Listeners

### The Event Service Provider

Map events to their listeners by subclassing `EventServiceProvider` and filling in `listen`. Each key is an event class, and each value is a list of listeners, called in order:

```python
# app/providers/event_service_provider.py
from fastapi_startkit.events import EventServiceProvider

from app.events.order_shipped import OrderShipped
from app.listeners.record_shipment import record_shipment
from app.listeners.send_shipment_notification import SendShipmentNotification


class AppEventServiceProvider(EventServiceProvider):
    listen = {
        OrderShipped: [SendShipmentNotification, record_shipment],
    }
```

Then add the provider to `bootstrap/application.py`:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit.application import Application
from fastapi_startkit.mail import MailProvider

from app.providers.event_service_provider import AppEventServiceProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        MailProvider,
        AppEventServiceProvider,
    ],
)
```

### Registering Listeners Manually

You can also register a listener with `Event.listen()`, for example in a provider's `boot()` method. Used without a listener, it works as a decorator:

```python
from fastapi_startkit.facades import Event

from app.events.order_shipped import OrderShipped
from app.listeners.record_shipment import record_shipment

Event.listen(OrderShipped, record_shipment)


@Event.listen(OrderShipped)
async def update_inventory(event: OrderShipped):
    ...
```

Pass a list to register one listener for several events.

### Named Events

An event can also be a string name instead of a class. A listener for a named event receives the payload as positional arguments, and a name with `*` matches several events:

```python
from fastapi_startkit.facades import Event


@Event.listen("orders.*")
def audit_order(order_id, status):
    print(f"Order {order_id} is {status}")
```

### Removing Listeners

`Event.has_listeners(event)` tells you whether anything listens for an event. `Event.forget(event)` removes every listener for one event, and `Event.flush()` removes all listeners.

## Dispatching Events

Dispatch an event by passing an instance to `Event.dispatch()`. The dispatcher calls each listener in the order it was registered and awaits async listeners:

```python
# app/services/orders.py
from fastapi_startkit.facades import Event

from app.events.order_shipped import OrderShipped


async def ship_order(order_id: int, email: str, tracking_number: str):
    ...
    await Event.dispatch(OrderShipped(order_id, email, tracking_number))
```

The `event()` helper does the same thing:

```python
from fastapi_startkit.events import event

await event(OrderShipped(order_id, email, tracking_number))
```

To dispatch a named event, pass the name and a payload. A list or tuple payload is spread into the listener's arguments, and any other value is passed as a single argument:

```python
await Event.dispatch("orders.shipped", [7, "shipped"])
# Order 7 is shipped
```

### Listener Responses

`dispatch()` returns a list with each listener's return value. When a listener returns `False`, the listeners after it don't run.

`Event.until()` stops at the first listener that returns something other than `None` and returns that value. Use it when you want one listener to answer a question:

```python
Event.listen("orders.shipping_quote", lambda order_id: None)
Event.listen("orders.shipping_quote", lambda order_id: 1999)

quote = await Event.until("orders.shipping_quote", 7)
# 1999
```

## Framework Events

When `FastAPIProvider` is registered, the framework dispatches a `RequestHandled` event after every HTTP request. It has `method`, `path`, `status_code`, `duration_ms` and `request_id` fields:

```python
import logging

from fastapi_startkit.facades import Event
from fastapi_startkit.fastapi import RequestHandled

logger = logging.getLogger("requests")


@Event.listen(RequestHandled)
def log_request(event: RequestHandled):
    logger.info("%s %s -> %s (%.1fms)", event.method, event.path, event.status_code, event.duration_ms)
```

## Faking Events in Tests

`Event.fake()` swaps the dispatcher for a fake that records events instead of running their listeners. It returns the fake, which you use to make assertions. Faking replaces the dispatcher in the container, so put it in a fixture that puts the real dispatcher back afterwards:

```python
# tests/test_ship_order.py
import pytest

from fastapi_startkit.facades import Event

from app.events.order_shipped import OrderShipped
from app.services.orders import ship_order


@pytest.fixture
def events():
    from bootstrap.application import app

    dispatcher = app.make("events")
    fake = Event.fake()
    yield fake
    app.bind("events", dispatcher)


async def test_shipping_an_order_dispatches_order_shipped(events):
    await ship_order(7, "ann@example.com", "1Z999")

    events.assert_dispatched(OrderShipped, lambda event: event.order_id == 7)
    events.assert_dispatched_times(OrderShipped, 1)


async def test_nothing_is_dispatched_before_shipping(events):
    events.assert_nothing_dispatched()
```

The fake has these methods:

| Method | Description |
|---|---|
| `assert_dispatched(event, callback=None)` | Fails unless the event was dispatched; with a callback, at least one dispatched event must make it return `True` |
| `assert_dispatched_times(event, times=1)` | Fails unless the event was dispatched exactly `times` times |
| `assert_not_dispatched(event, callback=None)` | Fails if the event was dispatched, or with a callback, if any dispatched event makes it return `True` |
| `assert_nothing_dispatched()` | Fails if any event was dispatched |
| `dispatched(event, callback=None)` | Returns the recorded events, filtered by the callback when given |

For a named event, `dispatched()` returns each payload as a list of arguments.

See [FastAPI Testing](/docs/testing/fastapi) for the pytest settings these tests use.

### Faking a Subset of Events

Pass a list of events to fake only those. Every other event still reaches its listeners:

```python
fake = Event.fake([OrderShipped])
```
