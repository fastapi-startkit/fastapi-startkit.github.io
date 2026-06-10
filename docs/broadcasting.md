---
outline: deep
title: Broadcasting
description: Real-time event broadcasting with Reverb — a self-hosted WebSocket server that implements the Pusher protocol, built into FastAPI Startkit.
keywords: broadcasting, websockets, reverb, pusher, real-time, fastapi, events, channels
---

# Broadcasting

FastAPI Startkit includes a built-in broadcasting module — **Reverb** — a self-hosted WebSocket server that implements the [Pusher WebSocket protocol](https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/). This means the official `pusher-js` browser SDK connects to it out of the box with **no external service required**.

## How It Works

```
[FastAPI App]
  broadcast(OrderShipped(order))
        │
        ▼
  [ReverbManager] ──publishes to──▶ [Reverb WS Server] ◀──pusher-js──▶ [Browser]
                                      (Starlette WS)
```

The Reverb WebSocket server runs **inside your existing FastAPI process** — no separate service to manage.

---

## Installation

Broadcasting is included in the core package. Register `ReverbProvider` in your application:

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

### Passing a config object

If your app uses `BroadcastingConfig` to read env-vars explicitly, pass it as a tuple alongside the provider (the same pattern used for `DatabaseProvider`, `FastAPIProvider`, etc.):

```python
from fastapi_startkit.broadcasting import ReverbProvider
from fastapi_startkit.broadcasting.config import BroadcastingConfig

app = Application(
    base_path=...,
    providers=[
        # ... other providers
        (ReverbProvider, BroadcastingConfig),
    ]
)
```

---

## Mounted Pattern

By default `ReverbProvider` registers the Reverb WebSocket server as a standalone ASGI app. When you need the WebSocket endpoint to live **under a sub-path of your existing FastAPI app** (e.g. `/reverb`) — useful when a single-origin constraint applies, or you want to avoid a separate port — mount it from inside your `AppProvider.boot()` method:

```python
# providers/app_provider.py
from fastapi_startkit.providers import Provider

class AppProvider(Provider):
    def boot(self) -> None:
        from routes.web import router
        self.app.fastapi.include_router(router.router)

        # Mount Reverb under /reverb — same origin as the FastAPI app
        reverb_server = self.app.make('reverb.server')
        self.app.fastapi.mount('/reverb', reverb_server.as_starlette_app('local'))
```

> [!IMPORTANT]
> **Order matters.** Call `include_router` **before** `mount`. FastAPI resolves routes in registration order; mounting before the router causes the `/reverb` prefix to shadow any API routes whose paths start with `/r`.

With the mounted pattern the Reverb WebSocket is reachable at:

```
ws://<host>:<port>/reverb/app/<REVERB_APP_KEY>
```

The corresponding `pusher-js` config uses `wsPath` to point the client at the mount point:

```js
import Pusher from "pusher-js";

const pusher = new Pusher("local", {
    wsHost: window.location.hostname,
    wsPort: Number(window.location.port) || 80,
    forceTLS: false,
    enabledTransports: ["ws"],
    cluster: "mt1",
    wsPath: "/reverb",   // <-- tells pusher-js to prefix all WS paths
});
```

### When to use the mounted pattern vs the standalone default

| Scenario | Recommendation |
|---|---|
| Single-port deployment (e.g. `dist/` build on `:4545`) | **Mounted** — no second port to manage |
| Separate WebSocket service / different host | Standalone (default) |
| Reverse-proxy that routes `/reverb` to FastAPI | **Mounted** |
| Simplest possible setup, two ports are fine | Standalone (default) |

---

## Configuration

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

All environment variables and their defaults:

| Variable | Default | Description |
|---|---|---|
| `BROADCAST_DRIVER` | `log` | Active driver: `reverb` or `log` |
| `REVERB_APP_ID` | `1` | Reverb application ID |
| `REVERB_APP_KEY` | `local` | Pusher-compatible app key sent by the client |
| `REVERB_APP_SECRET` | `secret` | Secret used to sign auth requests |
| `REVERB_HOST` | `0.0.0.0` | Interface the WS server binds to |
| `REVERB_PORT` | `8080` | Port the WS server listens on |
| `REVERB_SCHEME` | `http` | URL scheme (`http` or `https`) |

> [!NOTE]
> The default driver is `log`. Set `BROADCAST_DRIVER=reverb` to enable real WebSocket broadcasting.

---

## Defining Events

Create an event class that extends `BroadcastEvent` and implements `broadcast_on()`:

```python
from fastapi_startkit.broadcasting import BroadcastEvent, Channel

class OrderShipped(BroadcastEvent):
    def __init__(self, order_id: int, customer_email: str):
        self.order_id = order_id
        self.customer_email = customer_email

    def broadcast_on(self):
        return [Channel(f"orders.{self.order_id}")]
```

### Customising the event name

By default the event name is the class name (`OrderShipped`). Override `broadcast_as()` to change it:

```python
def broadcast_as(self) -> str:
    return "order.shipped"
```

### Customising the payload

By default `broadcast_with()` returns all instance attributes as a dict. Override it to control exactly what is sent to the client:

```python
def broadcast_with(self) -> dict:
    return {
        "order_id": self.order_id,
        "status": "shipped",
    }
```

### Full example

```python
from fastapi_startkit.broadcasting import BroadcastEvent, PrivateChannel

class OrderShipped(BroadcastEvent):
    def __init__(self, order_id: int, customer_email: str):
        self.order_id = order_id
        self.customer_email = customer_email

    def broadcast_on(self):
        return [PrivateChannel(f"orders.{self.order_id}")]

    def broadcast_as(self) -> str:
        return "OrderShipped"

    def broadcast_with(self) -> dict:
        return {
            "order_id": self.order_id,
            "status": "shipped",
        }
```

---

## Channel Types

| Class | Channel prefix | Use case |
|---|---|---|
| `Channel` | _(none)_ | Public — anyone can subscribe |
| `PrivateChannel` | `private-` | Authenticated users only |
| `PresenceChannel` | `presence-` | Authenticated + user list |

```python
from fastapi_startkit.broadcasting import Channel, PrivateChannel, PresenceChannel

# Public channel — broadcast to "orders.1"
def broadcast_on(self):
    return [Channel(f"orders.{self.order_id}")]

# Private channel — broadcast to "private-orders.1"
def broadcast_on(self):
    return [PrivateChannel(f"orders.{self.order_id}")]

# Presence channel — broadcast to "presence-orders.1"
def broadcast_on(self):
    return [PresenceChannel(f"orders.{self.order_id}")]
```

---

## Broadcasting Events

### Using the helper function

```python
from fastapi_startkit.broadcasting import broadcast

@router.post("/orders/{order_id}/ship")
async def ship_order(order_id: int):
    # ... business logic ...
    await broadcast(OrderShipped(order_id, customer_email="user@example.com"))
    return {"status": "shipped"}
```

### Using the Facade

```python
from fastapi_startkit.facades.Broadcast import Broadcast

@router.post("/orders/{order_id}/ship")
async def ship_order(order_id: int):
    await Broadcast.event(OrderShipped(order_id, customer_email="user@example.com"))
    return {"status": "shipped"}
```

---

## Local Development

During development, set `BROADCAST_DRIVER=log` to print events to the console without needing a WebSocket connection:

```ini
BROADCAST_DRIVER=log
```

When the log driver is active, each `broadcast()` call writes a structured line to the `reverb` logger:

```
[Broadcast] channel=orders.1 event=OrderShipped data={'order_id': 1, 'status': 'shipped'}
```

`log` is the **default driver**, so if `BROADCAST_DRIVER` is not set at all, events are safely logged and never sent over WebSockets. This makes it safe to leave broadcasting calls in your code during testing without any WebSocket infrastructure.

---

## Frontend (pusher-js)

Install `pusher-js` in your frontend project:

```bash
npm install pusher-js
```

### Standalone (separate port)

Connect to the Reverb server — point `wsHost` and `wsPort` at your FastAPI app:

```js
import Pusher from "pusher-js";

const pusher = new Pusher("local", {
    wsHost: "127.0.0.1",
    wsPort: 8080,
    forceTLS: false,
    enabledTransports: ["ws"],
    cluster: "mt1",
});

const channel = pusher.subscribe("orders.1");

channel.bind("OrderShipped", (data) => {
    console.log("Order shipped:", data);
});
```

### Mounted (same port, sub-path)

When using the [mounted pattern](#mounted-pattern), add `wsPath` to tell `pusher-js` the mount point:

```js
import Pusher from "pusher-js";

const { hostname, port } = window.location;

const pusher = new Pusher("local", {
    wsHost: hostname,
    wsPort: port ? Number(port) : 80,
    forceTLS: false,
    enabledTransports: ["ws"],
    cluster: "mt1",
    wsPath: "/reverb",
});

const channel = pusher.subscribe("orders.1");

channel.bind("OrderShipped", (data) => {
    console.log("Order shipped:", data);
});
```

> [!TIP]
> The first argument to `new Pusher(...)` is the `REVERB_APP_KEY`. It must match the value configured in your `.env` file.

### React hook

A lightweight custom hook that wraps `pusher-js` and returns an accumulated messages array:

```ts
// hooks/useBroadcastChannel.ts
import { useEffect, useRef, useState } from 'react'
import Pusher, { type Channel } from 'pusher-js'

export interface BroadcastMessage {
    event: string
    data: Record<string, unknown>
    receivedAt: number
}

export function useBroadcastChannel(channelName: string): BroadcastMessage[] {
    const [messages, setMessages] = useState<BroadcastMessage[]>([])
    const pusherRef = useRef<Pusher | null>(null)
    const channelRef = useRef<Channel | null>(null)

    useEffect(() => {
        const { hostname, port } = window.location

        const pusher = new Pusher('local', {
            wsHost: hostname,
            wsPort: port ? Number(port) : 80,
            forceTLS: false,
            enabledTransports: ['ws'],
            cluster: 'mt1',
            wsPath: '/reverb',
        })

        pusherRef.current = pusher
        const channel = pusher.subscribe(channelName)
        channelRef.current = channel

        channel.bind_global((eventName: string, data: Record<string, unknown>) => {
            if (eventName.startsWith('pusher:')) return
            setMessages(prev => [...prev, { event: eventName, data, receivedAt: Date.now() }])
        })

        return () => {
            channel.unbind_all()
            pusher.unsubscribe(channelName)
            pusher.disconnect()
        }
    }, [channelName])

    return messages
}
```

Usage:

```tsx
import { useBroadcastChannel } from '@/hooks/useBroadcastChannel'

export function OrderList() {
    const messages = useBroadcastChannel('orders')
    return (
        <ul>
            {messages.map((msg, i) => (
                <li key={i}>{JSON.stringify(msg.data)}</li>
            ))}
        </ul>
    )
}
```
