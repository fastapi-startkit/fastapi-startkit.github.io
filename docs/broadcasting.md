---
outline: deep
title: Broadcasting
description: Real-time event broadcasting with Reverb — a self-hosted WebSocket server that implements the Pusher protocol, built into FastAPI Startkit.
keywords: broadcasting, websockets, reverb, pusher, real-time, fastapi, events, channels
---

# Broadcasting

Broadcasting sends server-side events to the browser over WebSockets. FastAPI Startkit ships Reverb, a WebSocket server that speaks the [Pusher WebSocket protocol](https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/), so the official `pusher-js` client can connect to it without a hosted service.

## How It Works

```
[FastAPI App]
  broadcast(OrderShipped(order))
        │
        ▼
  [BroadcastManager] ──publishes to──▶ [Reverb WS Server] ◀──pusher-js──▶ [Browser]
                                      (Starlette WS)
```

Reverb runs inside your FastAPI process, so there is no separate service to deploy.

## Installation

Broadcasting is part of the core package. Register `ReverbProvider` in your application:

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

To pass a config class, register the provider as a tuple, the same way as `DatabaseProvider` or `FastAPIProvider`:

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

## Mounted Pattern

By default, `ReverbProvider` mounts the WebSocket endpoint at `/app/<REVERB_APP_KEY>` on your FastAPI app, on the same host and port. To serve it under a sub-path such as `/reverb` instead, for example behind a reverse proxy that routes that path to FastAPI, mount the server yourself in `AppProvider.boot()`:

```python
# providers/app_provider.py
from fastapi_startkit.support import Provider

class AppProvider(Provider):
    def boot(self) -> None:
        from routes.web import router
        self.app.fastapi.include_router(router.router)

        # Mount Reverb under /reverb — same origin as the FastAPI app
        reverb_server = self.app.make('reverb.server')
        self.app.fastapi.mount('/reverb', reverb_server.as_starlette_app('local'))
```

> [!IMPORTANT]
> Call `include_router` before `mount`. Starlette matches routes in the order they were added, so register your own routes first.

The WebSocket is then served at:

```
ws://<host>:<port>/reverb/app/<REVERB_APP_KEY>
```

In `pusher-js`, set `wsPath` to the mount point:

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

## Configuration

Add these values to your `.env` file:

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
| `BROADCAST_DRIVER` | `log` | Active driver: `reverb` or `log` |
| `REVERB_APP_ID` | `1` | Reverb application ID |
| `REVERB_APP_KEY` | `local` | Pusher-compatible app key sent by the client |
| `REVERB_APP_SECRET` | `secret` | Reverb app secret (not used to sign auth responses yet) |
| `REVERB_HOST` | `0.0.0.0` | Reverb host (not used by the built-in endpoint, which runs on the FastAPI server) |
| `REVERB_PORT` | `8080` | Reverb port (not used by the built-in endpoint, which runs on the FastAPI server) |
| `REVERB_SCHEME` | `http` | URL scheme (`http` or `https`) |

> [!NOTE]
> The default `log` driver only writes events to the log. Set `BROADCAST_DRIVER=reverb` to send them over WebSockets.

## Defining Events

An event extends `BroadcastEvent` and returns its channels from `broadcast_on()`:

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

By default, `broadcast_with()` returns the event's `payload` if it is set, or else all instance attributes. Override it to choose what the client receives:

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

## Local Development

Set `BROADCAST_DRIVER=log` to write events to the log instead of sending them:

```ini
BROADCAST_DRIVER=log
```

Each `broadcast()` call then writes a line to the `reverb` logger:

```
[Broadcast] channel=orders.1 event=OrderShipped data={'order_id': 1, 'status': 'shipped'}
```

`log` is the default driver, so when `BROADCAST_DRIVER` is unset, events are logged and never sent. Your tests can call `broadcast()` without a WebSocket server.

## Frontend (pusher-js)

Install `pusher-js` in your frontend project:

```bash
npm install pusher-js
```

### Default endpoint

Point `wsHost` and `wsPort` at your FastAPI server:

```js
import Pusher from "pusher-js";

const pusher = new Pusher("local", {
    wsHost: "127.0.0.1",
    wsPort: 8000,
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

With the [mounted pattern](#mounted-pattern), add `wsPath`:

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
> The first argument to `new Pusher(...)` is your `REVERB_APP_KEY` and must match the value in `.env`.

### React hook

This hook subscribes to a channel and returns every message received so far:

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
