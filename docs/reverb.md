---
outline: deep
title: Reverb (Broadcasting)
description: Real-time WebSocket broadcasting with Reverb — a self-hosted Pusher-protocol server built into FastAPI Startkit. Use Laravel Echo or pusher-js to subscribe from the browser.
keywords: reverb, broadcasting, websockets, pusher, real-time, channels, private channel, presence channel, fastapi startkit, laravel echo
---

# Reverb

FastAPI Startkit ships **Reverb** — a self-hosted WebSocket server that speaks the [Pusher protocol](https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/). This means the official `pusher-js` browser SDK and **Laravel Echo** connect to it out of the box, with no external service, no Pusher account, and no extra infrastructure.

Events are broadcast from your Python code, delivered over WebSocket, and received by any subscribing browser or client.

---

## Installation

Broadcasting is included in the core package — no extra pip install is required. Add `ReverbProvider` to your provider list and set a few environment variables.

### Register the provider

```python
# bootstrap/application.py
from fastapi_startkit import Application
from fastapi_startkit.broadcasting import ReverbProvider

app = Application(
    base_path=...,
    providers=[
        # ... other providers
        ReverbProvider,
    ]
)
```

That is all. `ReverbProvider` wires up the WebSocket endpoint, the channel authorization endpoint, and auto-loads your `routes/channels.py` file.

### Environment variables

Add the following to your `.env` file:

```ini
BROADCAST_DRIVER=reverb

REVERB_APP_ID=local
REVERB_APP_KEY=local
REVERB_APP_SECRET=secret
REVERB_HOST=0.0.0.0
REVERB_PORT=8080
REVERB_SCHEME=http
```

| Variable | Default | Description |
|---|---|---|
| `BROADCAST_DRIVER` | `log` | Active driver — `reverb` to send over WebSocket, `log` to print locally |
| `REVERB_APP_ID` | `1` | Application ID |
| `REVERB_APP_KEY` | `local` | Pusher-compatible app key sent by the client |
| `REVERB_APP_SECRET` | `secret` | Secret used to sign auth requests |
| `REVERB_HOST` | `0.0.0.0` | Interface the WebSocket server binds to |
| `REVERB_PORT` | `8080` | Port the WebSocket server listens on |
| `REVERB_SCHEME` | `http` | URL scheme (`http` or `https`) |

> [!NOTE]
> The default driver is `log`. Set `BROADCAST_DRIVER=reverb` to enable real WebSocket broadcasting. During development you can leave the default so events are printed to the console without a WebSocket connection.

---

## Defining Events

Create a class that extends `BroadcastEvent` and implement `broadcast_on()` to declare which channels it broadcasts on.

```python
from fastapi_startkit.broadcasting import BroadcastEvent, PrivateChannel

class OrderShipped(BroadcastEvent):
    def __init__(self, order_id: int):
        self.order_id = order_id

    def broadcast_on(self):
        return [PrivateChannel(f"orders.{self.order_id}")]
```

### Customising the event name

By default the event name sent to subscribers is the class name (`OrderShipped`). Override `broadcast_as()` to change it:

```python
def broadcast_as(self) -> str:
    return "order.shipped"
```

### Customising the payload

By default `broadcast_with()` serialises all instance attributes. Override it to control exactly what is sent:

```python
def broadcast_with(self) -> dict:
    return {
        "order_id": self.order_id,
        "status": "shipped",
    }
```

---

## Emitting Events

### `.emit()` shorthand

Call `.emit()` directly on an event instance — it dispatches through the `Broadcast` facade:

```python
from app.events.order_shipped import OrderShipped

@router.post("/orders/{order_id}/ship")
async def ship_order(order_id: int):
    # ... business logic ...
    OrderShipped(order_id).emit()
    return {"status": "shipped"}
```

### `Broadcast.event()` escape hatch

Use the `Broadcast` facade when you need `await` or explicit control:

```python
from fastapi_startkit.facades.Broadcast import Broadcast
from app.events.order_shipped import OrderShipped

@router.post("/orders/{order_id}/ship")
async def ship_order(order_id: int):
    await Broadcast.event(OrderShipped(order_id))
    return {"status": "shipped"}
```

---

## Channel Types

| Class | Wire prefix | Use case |
|---|---|---|
| `Channel` | _(none)_ | Public — anyone can subscribe |
| `PrivateChannel` | `private-` | Authenticated users only |
| `PresenceChannel` | `presence-` | Authenticated + user-list tracking |

```python
from fastapi_startkit.broadcasting import Channel, PrivateChannel, PresenceChannel

# Public — broadcast to "orders.1"
def broadcast_on(self):
    return [Channel(f"orders.{self.order_id}")]

# Private — broadcast to "private-orders.1"
def broadcast_on(self):
    return [PrivateChannel(f"orders.{self.order_id}")]

# Presence — broadcast to "presence-orders.1"
def broadcast_on(self):
    return [PresenceChannel(f"orders.{self.order_id}")]
```

---

## Channel Authorization

Private and presence channels require authorization. Define callbacks in `routes/channels.py` using the `@Broadcast.channel()` decorator. `ReverbProvider` loads this file automatically on boot.

```python
# routes/channels.py
from fastapi_startkit.facades.Broadcast import Broadcast

@Broadcast.channel("orders.{order_id}")
async def authorize_orders_channel(user, order_id: int) -> bool:
    """Authorize the private ``orders.{order_id}`` channel.

    Wildcard segments (``{order_id}``) are extracted from the channel name
    and injected as typed parameters — the ``int`` hint coerces the string
    automatically.  The first argument is always the authenticated user.

    Return ``True`` to allow, ``False`` to deny.
    """
    return user is not None and user.id == order_id
```

### How wildcards work

When a client subscribes to `private-orders.42`, Reverb:

1. Strips the `private-` prefix to get `orders.42`.
2. Matches it against registered patterns — `orders.{order_id}` matches.
3. Extracts `order_id=42` and coerces it using the type hint (`int`).
4. Calls the callback with `(user, order_id=42)`.
5. Grants or denies the subscription based on the return value.

### Multiple channels

Register as many callbacks as you need:

```python
@Broadcast.channel("orders.{order_id}")
async def authorize_orders(user, order_id: int) -> bool:
    return user is not None and user.id == order_id

@Broadcast.channel("notifications")
async def authorize_notifications(user) -> bool:
    return user is not None
```

---

## Frontend (Laravel Echo / pusher-js)

Install `pusher-js` in your frontend project:

```bash
npm install pusher-js
```

Connect to the Reverb server — point `wsHost` and `wsPort` at your running app:

```js
import Pusher from "pusher-js";

const pusher = new Pusher("local", {   // must match REVERB_APP_KEY
    wsHost: "127.0.0.1",
    wsPort: 8080,                      // must match REVERB_PORT
    forceTLS: false,
    enabledTransports: ["ws"],
    cluster: "mt1",
});

const channel = pusher.subscribe("orders.1");

channel.bind("OrderShipped", (data) => {
    console.log("Order shipped:", data);
});
```

For **Laravel Echo**:

```js
import Echo from "laravel-echo";
import Pusher from "pusher-js";

window.Pusher = Pusher;

const echo = new Echo({
    broadcaster: "reverb",
    key: "local",
    wsHost: "127.0.0.1",
    wsPort: 8080,
    forceTLS: false,
    enabledTransports: ["ws"],
});

echo.private(`orders.${orderId}`)
    .listen("OrderShipped", (e) => {
        console.log(e);
    });
```

> [!TIP]
> The first argument to `new Pusher(...)` or the `key` option in Echo must match the value of `REVERB_APP_KEY` in your `.env` file.

---

## Local Development

Leave `BROADCAST_DRIVER=log` (the default) during development. Events are printed to the console so you can verify they fire without running a WebSocket client:

```
[Broadcast] channel=private-orders.1 event=OrderShipped data={'order_id': 1, 'status': 'shipped'}
```
