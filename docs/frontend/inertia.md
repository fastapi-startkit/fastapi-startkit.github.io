---
outline: deep
title: Inertia
description: Build modern single-page applications without the complexity of a separate API using Inertia.js and Fastapi Startkit.
keywords: inertia, spa, frontend, fastapi, monolithic
---
# Inertia

[Inertia.js](https://inertiajs.com) is a protocol that bridges your server and frontend, letting you build full-stack single-page applications without building a separate API. Instead of writing REST endpoints and consuming them with `fetch()`, you write controllers that return component names and props — Inertia takes care of the rest.

For FastAPI developers, this means you get the speed and structure of server-side routing with the interactivity of a modern frontend, using your choice of React, Vue, or Svelte — with far less boilerplate than a traditional API-driven SPA. 

The `InertiaProvider` wires Inertia into your application: it binds the `Inertia` renderer to the container, registers `InertiaMiddleware`, and injects the <code v-pre>{{ inertia(page) }}</code> Jinja2 helper into your templates.

## Setup

Register `InertiaProvider` after `ViteProvider`, which provides the Jinja2 templates:

```python
# bootstrap/application.py
from fastapi_startkit.inertia import InertiaProvider
from fastapi_startkit.vite import ViteProvider

app = Application(
    base_path=...,
    providers=[
        ViteProvider,
        InertiaProvider,
        ...
    ],
)
```

## Root Template

Create `templates/index.html`. The <code v-pre>{{ inertia(page) }}</code> helper renders the bootstrap `<script>` tag and the `<div id="app">` mount point:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    {{ vite_react_refresh() }}
    {{ vite('resources/js/app.tsx') }}
</head>
<body>
    {{ inertia(page) }}
</body>
</html>
```

This renders:

```html
<script data-page="app" type="application/json">
  {"component": "...", "props": {...}, ...}
</script>
<div id="app"></div>
```

## Rendering Components

Use `Inertia.render()` in your controller. It takes the component name and an optional props dict — no `request` argument is needed, because `InertiaMiddleware` stores the current request in a context variable automatically:

```python
from fastapi_startkit.inertia import Inertia

async def index():
    return Inertia.render("Dashboard/Index", {
        "user": {"name": "Alice"},
    })
```

Props are optional. When a controller has no props to pass, omit the second argument:

```python
async def index():
    return Inertia.render("Dashboard/Index")
```

- On the **first page load**, returns an HTML response using the root template.
- On **Inertia XHR requests** (`X-Inertia: true` header), returns a JSON response with component name, props, and URL.

## Shared Data

Share data globally — available as props on every component. The right place to call `share()` is inside a provider's `boot()` method, after all providers have been registered:

```python
# providers/fastapi_provider.py
from fastapi_startkit.fastapi import FastAPIProvider as BaseFastAPIProvider
from fastapi_startkit.inertia import Inertia

class FastAPIProvider(BaseFastAPIProvider):
    def boot(self) -> None:
        super().boot()

        # Static value
        Inertia.share("app_name", "PingCRM")

        # Callable resolved per-request (receives the request object)
        Inertia.share("auth", lambda request: {
            "user": getattr(request.state, "user", None),
        })

        # Callable resolved per-request (receives the request object)
        Inertia.share("flash", lambda request: {
            "success": request.session.get("flash_success") if "session" in request.scope else None,
        })
```

You can also call `Inertia.share()` via the container binding (they are the same object):

```python
inertia = self.app.make("inertia")
inertia.share("app_name", "PingCRM")
```

Shared data is merged with per-render props. Per-render props take precedence.

## Partial Reloads

Wrap prop values in callables so they are resolved lazily. On a partial reload only the requested keys are evaluated. Because async is not allowed inside a `lambda`, use a named `async def` for async props:

```python
from fastapi_startkit.inertia import Inertia
from app.models import User, Organization

async def index():
    async def get_users():
        return await User.all()

    async def get_organizations():
        return await Organization.get()

    return Inertia.render('Users/Index', {
        'users': get_users,
        'companies': get_organizations,
    })
```

Use `Inertia.optional()` to mark a prop as never included unless explicitly requested via the `only` option:

```python
async def index():
    async def get_users():
        return await User.all()

    return Inertia.render('Users/Index', {
        'users': Inertia.optional(get_users),
    })
```

## Asset Versioning

`InertiaMiddleware` automatically uses the Vite manifest hash as the asset version when a `ViteProvider` is registered — no extra configuration is needed in the common case.

To override with a fixed version string, call `Inertia.version()` in a provider's `boot()` method:

```python
from fastapi_startkit.inertia import Inertia

class FastAPIProvider(BaseFastAPIProvider):
    def boot(self) -> None:
        super().boot()
        Inertia.version("1.0.0")
```

When the client's `X-Inertia-Version` header mismatches the server version, the middleware returns `409 Conflict` with an `X-Inertia-Location` header, causing the client to perform a full hard reload.

## Middleware

`InertiaMiddleware` is registered automatically by `InertiaProvider`. It handles three concerns:

1. **Version check** — returns `409` on version mismatch (triggers hard reload).
2. **Redirect conversion** — converts `302` redirects to `303` for `PUT`/`PATCH`/`DELETE` requests, so the browser performs a `GET` on the redirect target.
3. **Vary header** — adds `Vary: X-Inertia` to every response for correct cache behaviour.

## Custom Root View

Change the root template name (default: `index.html`):

```python
from fastapi_startkit.inertia import Inertia

Inertia.set_root_view("app.html")
```

## Client-Side Setup (React)

For frontend tooling setup (Vite, package.json, tsconfig, Tailwind) see the [Vite docs](/docs/frontend/vite).

For Inertia you need to additionally install `@inertiajs/react` and the Vite plugin:

```bash
npm install @inertiajs/react
npm install -D @inertiajs/vite
```

Then add `@inertiajs/vite` to your `vite.config.js` input via `fastapi-vite-plugin`:

```js
// vite.config.js
import fastapi from 'fastapi-vite-plugin'

export default defineConfig({
    plugins: [
        fastapi({
            input: 'resources/js/app.tsx',  // [!code ++]
            refresh: true,
        }),
        // ...
    ],
})
```

### Entry point (`resources/js/app.tsx`)

```tsx
import '../css/app.css'
import { createInertiaApp } from "@inertiajs/react"
import { createRoot } from "react-dom/client"

const appName = import.meta.env.VITE_APP_NAME || "My App"

createInertiaApp({
    title: title => `${title} - ${appName}`,
    resolve: name => {
        const pages = import.meta.glob('./Pages/**/*.tsx', { eager: true })
        return pages[`./Pages/${name}.tsx`]
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />)
    },
    progress: {
        color: "#F87415",
    },
})
```

### Named routes

Inertia's client-side components often use a `route()` helper for generating URLs and checking the active route (e.g. for nav highlighting). Add it directly in `app.tsx`:

```tsx
// Map your server-side route names to URLs
const routeMap: Record<string, string> = {
    'dashboard': '/',
    'login': '/login',
    'users': '/users',
    'organizations': '/organizations',
    'contacts': '/contacts',
    'reports': '/reports',
}

// Reverse map for current() lookup
const reverseRouteMap = Object.fromEntries(
    Object.entries(routeMap).map(([k, v]) => [v, k])
)

function currentRouteName(): string {
    const pathname = window.location.pathname
    if (reverseRouteMap[pathname]) return reverseRouteMap[pathname]
    const parts = pathname.replace(/^\//, '').split('/')
    if (parts.length >= 3 && parts[2] === 'edit') return `${parts[0]}.edit`
    if (parts.length >= 2 && parts[1] === 'create') return `${parts[0]}.create`
    if (parts.length >= 2) return `${parts[0]}.show`
    return parts[0] || 'dashboard'
}

window.route = function(name, params, absolute) {
    let path = "/"
    if (name) {
        if (routeMap[name]) {
            path = routeMap[name]
        } else {
            const parts = name.split('.')
            path = "/" + parts[0]
            if (parts[1] === 'edit' && params) path += `/${params}/edit`
            else if (parts[1] === 'destroy' && params) path += `/${params}`
            else if (parts[1] === 'update' && params) path += `/${params}`
            else if (parts[1] === 'create') path += "/create"
        }
    }
    // Return a URL instance — Inertia's visit() handles URL objects natively
    const urlObj = new URL(path, window.location.href) as URL & { current: (pattern?: string) => string | boolean }
    urlObj.current = function(pattern?: string) {
        if (!pattern) return currentRouteName()
        const segment = window.location.pathname.replace(/^\//, '').split('/')[0] || 'dashboard'
        return new RegExp('^' + pattern.replace(/\*/g, '.*') + '$').test(segment)
    }
    return urlObj as any
}
```

`route().current()` with no argument returns the active route name — used by nav components to highlight the current page. With a pattern argument it returns a boolean, e.g. `route().current('users*')`.
