---
outline: deep
title: Broadcasting
description: Send server-side events to the browser over WebSockets with Reverb, a Pusher-protocol server that runs inside your FastAPI application.
keywords: broadcasting, websockets, reverb, pusher, real-time, fastapi, events, channels, private channels, presence channels
---

# Broadcasting

Broadcasting sends server-side events to the browser over WebSockets, so a page can update the moment an order ships or a comment arrives instead of polling for changes. The framework ships with Reverb, a WebSocket server that speaks the [Pusher protocol](https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/) and runs inside your FastAPI application. The `pusher-js` client connects to it directly, with no hosted service to sign up for.

- [Installation](#installation)
- [Configuration](#configuration)
- [Defining Broadcast Events](#defining-broadcast-events)
- [Broadcasting Events](#broadcasting-events)
- [Choosing a Channel Type](#choosing-a-channel-type)
- [Authorizing Channels](#authorizing-channels)
- [Listening in the Browser](#listening-in-the-browser)
- [Serving Reverb Under a Sub-Path](#serving-reverb-under-a-sub-path)
- [Logging Broadcasts in Development](#logging-broadcasts-in-development)

## Installation

Broadcasting needs the framework's `fastapi` extra. Register `ReverbProvider` alongside `FastAPIProvider` in `bootstrap/application.py`:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.broadcasting import ReverbProvider
from fastapi_startkit.fastapi import FastAPIProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        FastAPIProvider,
        ReverbProvider,
    ],
)
```

When it boots, `ReverbProvider` adds two routes to your FastAPI application:

- A WebSocket endpoint at `/app/<REVERB_APP_KEY>` that browsers connect to.
- A `POST /broadcasting/auth` endpoint that signs subscriptions to private and presence channels.

It also imports `routes/channels.py`, if it exists, so your [channel authorization](#authorizing-channels) callbacks are registered.

To pass your own config class, register the provider as a tuple: `(ReverbProvider, BroadcastingConfig)`, with `BroadcastingConfig` imported from `fastapi_startkit.broadcasting.config`.

## Configuration

Broadcasting reads its settings from environment variables. Add them to your `.env` file:

```ini
# .env
BROADCAST_DRIVER=reverb
REVERB_APP_KEY=local
REVERB_APP_SECRET=change-me-to-a-long-random-string
```

| Variable | Default | Description |
|---|---|---|
| `BROADCAST_DRIVER` | `log` | `reverb` sends events over WebSockets; `log` writes them to the log |
| `REVERB_APP_KEY` | `local` | The app key the browser connects with; it is also part of the WebSocket path |
| `REVERB_APP_SECRET` | _(empty)_ | Signs and verifies private and presence channel subscriptions |

::: warning
When `APP_ENV` is anything other than `local` or `testing`, `ReverbProvider` raises a `RuntimeError` at boot if `REVERB_APP_SECRET` is empty or `secret`. With no secret at all, `/broadcasting/auth` rejects every request, so private and presence channels only work once you set one.
:::

## Defining Broadcast Events

Each thing you broadcast is a class that extends `BroadcastEvent`. Its `broadcast_on()` method returns the channels the event is sent on:

```python
# app/events/order_shipped.py
from fastapi_startkit.broadcasting import BroadcastEvent, PrivateChannel


class OrderShipped(BroadcastEvent):
    def __init__(self, order_id: int, tracking_number: str):
        self.order_id = order_id
        self.tracking_number = tracking_number

    def broadcast_on(self):
        return [PrivateChannel(f"orders.{self.order_id}")]
```

By default, the event name is the class name, `OrderShipped`, and the payload is every instance attribute: `{"order_id": 7, "tracking_number": "1Z999"}`.

### Customizing the Event Name

To change the name the browser listens for, override `broadcast_as()`:

```python
def broadcast_as(self) -> str:
    return "order.shipped"
```

Setting a `name` class attribute does the same thing.

### Customizing the Payload

To choose exactly what the browser receives, override `broadcast_with()`:

```python
def broadcast_with(self) -> dict:
    return {
        "order_id": self.order_id,
        "status": "shipped",
    }
```

Alternatively, set `self.payload` to a dictionary in `__init__`. When `payload` is not empty, it is sent instead of the instance attributes.

## Broadcasting Events

To send an event, pass it to the `broadcast()` helper. It sends the event to every channel returned by `broadcast_on()` using the configured driver:

```python
# routes/api.py
from fastapi_startkit.broadcasting import broadcast
from fastapi_startkit.fastapi import Router

from app.events.order_shipped import OrderShipped

router = Router()


async def ship(order_id: int):
    await broadcast(OrderShipped(order_id, tracking_number="1Z999"))
    return {"status": "shipped"}


router.post("/orders/{order_id}/ship", ship)
```

You may also call `emit()` on the event itself, which does the same thing:

```python
await OrderShipped(order.id, tracking_number="1Z999").emit()
```

To send a one-off message without defining an event class, call `emit()` on the `broadcasting` service with a channel name, an event name and a payload:

```python
from fastapi_startkit.application import app

await app().make("broadcasting").emit("orders.7", "order.delayed", {"days": 2})
```

::: warning
Reverb keeps its WebSocket connections in the memory of the process that accepted them. A broadcast only reaches browsers connected to the same process, so it must be sent from the web process that serves the WebSocket endpoint, not from a queue worker or a second server process.
:::

## Choosing a Channel Type

The channel class decides who may listen:

| Class | Channel name | Who can subscribe |
|---|---|---|
| `Channel("orders.7")` | `orders.7` | Anyone |
| `PrivateChannel("orders.7")` | `private-orders.7` | Users your authorization callback allows |
| `PresenceChannel("rooms.1")` | `presence-rooms.1` | Users your authorization callback allows; the signed response includes the user's ID |

An event may return several channels; it is sent to each of them:

```python
def broadcast_on(self):
    return [
        Channel("orders"),
        PrivateChannel(f"orders.{self.order_id}"),
    ]
```

## Authorizing Channels

Before the browser can subscribe to a private or presence channel, it asks `POST /broadcasting/auth` for a signature. The endpoint runs your authorization callback for that channel and signs the subscription only when the callback returns `True`. A private or presence channel with no matching callback is always denied.

Register callbacks in `routes/channels.py` with the `channel()` decorator. The pattern is matched against the full channel name, including the `private-` or `presence-` prefix. Each `{placeholder}` matches one dot-separated segment and is passed to the callback, cast to the parameter's type hint:

```python
# routes/channels.py
from fastapi_startkit.broadcasting import channel


@channel("private-orders.{order_id}")
async def authorize_order(user, order_id: int) -> bool:
    return user.id == order_id


@channel("presence-rooms.{room_id}")
async def authorize_room(user, room_id: int) -> bool:
    return True
```

`ReverbProvider` imports this file when it boots. To create it from the framework's stub, run:

```bash
uv run python artisan provider:publish --provider=broadcasting
```

### Providing the User

The endpoint reads the current user from `request.state.user`, so set it in your authentication middleware. When no user is set, the endpoint returns `403`, and your callback is never called. For presence channels, the user must also have an `id` attribute:

```python
# providers/app_provider.py
from fastapi_startkit.support import Provider


class AppProvider(Provider):
    def boot(self) -> None:
        @self.app.fastapi.middleware("http")
        async def attach_user(request, call_next):
            request.state.user = await resolve_user(request)
            return await call_next(request)
```

Here `resolve_user` stands for however your application looks up the signed-in user, for example from a session or a token.

When a callback allows the request, a private channel returns `{"auth": "<key>:<signature>"}`. A presence channel also returns `channel_data`, for example `{"user_id": "7"}`. Any other request receives `403` with `{"error": "Forbidden"}`.

## Listening in the Browser

In your frontend, install `pusher-js`:

```bash
npm install pusher-js
```

Then connect to your FastAPI server and bind to the event name. The first argument to `Pusher` is your `REVERB_APP_KEY`. To subscribe to private and presence channels, point `channelAuthorization` at the framework's auth endpoint:

```js
// resources/js/broadcasting.js
import Pusher from "pusher-js";

const pusher = new Pusher("local", {
    wsHost: window.location.hostname,
    wsPort: Number(window.location.port) || 80,
    forceTLS: false,
    enabledTransports: ["ws"],
    cluster: "mt1",
    channelAuthorization: {
        endpoint: "/broadcasting/auth",
    },
});

pusher.subscribe("private-orders.7").bind("order.shipped", (data) => {
    console.log("Order shipped:", data.tracking_number);
});
```

`pusher-js` requires a `cluster` option, but Reverb ignores it.

## Serving Reverb Under a Sub-Path

If a reverse proxy only forwards a single path to your application, you may mount a second copy of the WebSocket endpoint under that path. Resolve the `reverb.server` service and mount its Starlette app from one of your providers:

```python
# providers/app_provider.py
from fastapi_startkit.support import Provider


class AppProvider(Provider):
    def boot(self) -> None:
        reverb = self.app.make("reverb.server")
        self.app.fastapi.mount("/reverb", reverb.as_starlette_app(reverb.key))
```

The WebSocket is then also served at `/reverb/app/<REVERB_APP_KEY>`. Add `wsPath: "/reverb"` to the `pusher-js` options so the client connects there.

## Logging Broadcasts in Development

The `log` driver writes each broadcast to the `reverb` logger instead of sending it. It is the default, so events are logged when `BROADCAST_DRIVER` is not set:

```ini
# .env
BROADCAST_DRIVER=log
```

Broadcasting the `OrderShipped` event above then writes one line per channel:

```text
[Broadcast] channel=private-orders.7 event=order.shipped data={'order_id': 7, 'tracking_number': '1Z999'}
```

The `log` driver needs no WebSocket connection, so your tests can call `broadcast()` without one.

See [Notifications](/docs/notifications) to deliver notifications over a broadcast channel.
