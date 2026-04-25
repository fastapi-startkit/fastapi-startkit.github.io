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

Use `Inertia.render()` in your controller:

```python
from fastapi import Request
from fastapi_startkit.inertia import Inertia

async def index(request: Request):
    return Inertia.render(request, "Dashboard/Index", {
        "user": {"name": "Alice"},
    })
```

- On the **first page load**, returns an HTML response using the root template.
- On **Inertia XHR requests** (`X-Inertia: true` header), returns a JSON response with component name, props, and URL.

---

## Shared Data

Share data globally — available as props on every component:

```python
# providers/fastapi_provider.py or bootstrap/application.py
from fastapi_startkit.application import app

inertia = app().make("inertia")

# Static value
inertia.share("app_name", "PingCRM")

# Callable resolved per-request (receives the request object)
inertia.share("auth", lambda request: {
    "user": request.state.user,
})

# Callable resolved once (no parameters)
inertia.share("flash", lambda: {})
```

Shared data is merged with per-render props. Per-render props take precedence.

---

## Partial Reloads

```python
return Inertia.render('Users/Index', {
    'users': lambda : await User.all(),
    'companies': lambda await Organization.get()
})
```

and it also provides an `Inertia.optional()` method to specify that a props should never be included unless requested using the `only` option.

```python
return Inertia.render('Users/Index',{
    'users': Inertia.optional(lambda : await User.all())
})
```
 
---

## Asset Versioning

Set a version string so Inertia can detect asset changes and trigger a full-page reload:

```python
inertia = app().make("inertia")
inertia.version("1.0.0")

# Or tie it to the Vite manifest hash:
vite = app().make("vite")
inertia.version(vite.manifest_hash() or "1")
```

When the client's `X-Inertia-Version` header mismatches the server version, the middleware returns `409 Conflict` with an `X-Inertia-Location` header, causing the client to perform a full hard reload.

---

## Middleware

`InertiaMiddleware` is registered automatically by `InertiaProvider`. It handles three concerns:

1. **Version check** — returns `409` on version mismatch (triggers hard reload).
2. **Redirect conversion** — converts `302` redirects to `303` for `PUT`/`PATCH`/`DELETE` requests, so the browser performs a `GET` on the redirect target.
3. **Vary header** — adds `Vary: X-Inertia` to every response for correct cache behaviour.

---

## Custom Root View

Change the root template name (default: `index.html`):

```python
inertia = app().make("inertia")
inertia.set_root_view("app.html")
```

---

## Client-Side Setup (React)

Create `resources/js/app.tsx` as the Inertia bootstrap entry point.

### Basic setup

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

window.route = function(name, params) {
    let url = name ? (routeMap[name] ?? '/' + name.split('.')[0]) : '/'
    if (params) {
        const action = name?.split('.')[1]
        if (action === 'edit') url += `/${params}/edit`
        else if (action === 'destroy' || action === 'update') url += `/${params}`
    }
    const routeObj = new String(url) as string & { current: (pattern?: string) => string | boolean }
    ;(routeObj as any).current = (pattern?: string) => {
        if (!pattern) return currentRouteName()
        return new RegExp('^' + pattern.replace(/\*/g, '.*') + '$').test(currentRouteName())
    }
    return routeObj
}
```

`route().current()` with no argument returns the active route name — used by nav components to highlight the current page. With a pattern argument it returns a boolean, e.g. `route().current('users*')`.
