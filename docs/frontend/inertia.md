---
outline: deep
title: Inertia
description: Build single-page applications with Inertia.js and FastAPI Startkit, without writing a separate API.
keywords: inertia, spa, frontend, fastapi, monolithic
---

# Inertia

[Inertia.js](https://inertiajs.com) lets you build a single-page app with server-side routing and controllers, without writing a separate API. Your controllers return a component name and props, and a React, Vue or Svelte component renders the page. Routing, authorization and data loading stay on the server.

`InertiaProvider` adds Inertia to your application. It registers `InertiaMiddleware` and adds the <code v-pre>{{ inertia(page) }}</code> and <code v-pre>{{ inertia_head(page) }}</code> helpers to your Jinja2 templates.

## Setup

When you create a project with `uvx fastapi-startkit@latest init` and pick React or Vue, the installer does this setup for you. See [Getting Started](/docs/getting-started#creating-a-project). To add Inertia to an existing project, follow the steps below.

### Server-Side Setup

Inertia renders its first page through a Jinja2 template and loads your assets with Vite, so set up [Vite](/docs/frontend/vite) first. Then install the `inertia` extra:

```bash
pip install "fastapi-startkit[fastapi,vite,inertia]"
# or
uv add "fastapi-startkit[fastapi,vite,inertia]"
```

Register `InertiaProvider` next to `ViteProvider`, and add a session middleware. Inertia keeps [flash data](#flash-data) and [validation errors](#validation-errors) in the session until the next page reads them:

```python
# bootstrap/application.py
from pathlib import Path

from starlette.middleware.sessions import SessionMiddleware

from fastapi_startkit.application import Application
from fastapi_startkit.environment import env
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.inertia import InertiaProvider
from fastapi_startkit.vite import ViteProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        FastAPIProvider,
        ViteProvider,
        InertiaProvider,
    ],
)

app.add_middleware(SessionMiddleware, secret_key=env("SESSION_SECRET"))
```

The session cookie is signed with `SESSION_SECRET`, so set it to a long random string in `.env`.

Your controllers can now return `Inertia.render()`:

```python
# app/http/controllers/dashboard_controller.py
from fastapi_startkit.inertia import Inertia


async def index():
    return Inertia.render("Dashboard/Index")
```

### Client-Side Setup

This guide uses React. Install the Inertia React adapter, React and the React plugin for Vite:

```bash
npm install @inertiajs/react react react-dom
npm install --save-dev @vitejs/plugin-react @types/react @types/react-dom
```

In `vite.config.ts`, change the entry point to `resources/js/app.tsx` and add the React plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // [!code ++]
import fastapi from 'fastapi-vite-plugin'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [
        fastapi({
            input: 'resources/js/app.ts', // [!code --]
            input: 'resources/js/app.tsx', // [!code ++]
            refresh: true,
        }),
        react(), // [!code ++]
        tailwindcss(),
    ],
})
```

Rename `resources/js/app.ts` to `resources/js/app.tsx` and start the Inertia app in it:

```tsx
// resources/js/app.tsx
import '../css/app.css'
import { createInertiaApp } from '@inertiajs/react'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'

createInertiaApp({
    resolve: name => {
        const pages = import.meta.glob<ComponentType>('./Pages/**/*.tsx', { eager: true, import: 'default' })
        return pages[`./Pages/${name}.tsx`]
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />)
    },
})
```

Then add a page component under `resources/js/Pages`. The component name you pass to `Inertia.render()` is its path inside that directory:

```tsx
// resources/js/Pages/Dashboard/Index.tsx
export default function Dashboard() {
    return <h1>Dashboard</h1>
}
```

### Root Template

The first visit to a page is rendered through a root template. Create `resources/templates/index.html`. The <code v-pre>{{ inertia(page) }}</code> helper outputs the page data and the `<div id="app">` element that the client mounts into, and <code v-pre>{{ inertia_head(page) }}</code> outputs the head tags from [server-side rendering](#server-side-rendering):

```html
<!-- resources/templates/index.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    {{ vite_react_refresh() }}
    {{ vite('resources/js/app.tsx') }}
    {{ inertia_head(page) }}
</head>
<body>
    {{ inertia(page) }}
</body>
</html>
```

To use a different id than `app`, call `Inertia.root_id("root")` in a provider's `boot()` method.

## Passing Props

`Inertia.render()` takes the component name and an optional dict of props. You don't pass the request; `InertiaMiddleware` keeps track of it for you:

```python
from fastapi_startkit.inertia import Inertia


async def index():
    return Inertia.render("Dashboard/Index", {
        "user": {"name": "Alice"},
    })
```

You may also add props to a response with `with_()`, which takes a key and value or a dict:

```python
return Inertia.render("Dashboard/Index").with_("user", user).with_({"stats": stats})
```

On the first visit, the response is the HTML of the root template. On later visits, the client sends an `X-Inertia: true` header and receives JSON with the component name, props and URL.

### Nested Props

Props can be nested dicts. Every level is resolved, so a callable or a [prop type](#prop-types) works at any depth:

```python
return Inertia.render("Dashboard/Index", {
    "auth": {
        "user": lambda: current_user(),
        "permissions": Inertia.defer(load_permissions),
    },
})
```

A key that contains a dot is expanded into the nested structure. Use it to add one value under a shared prop without replacing the whole prop:

```python
Inertia.share("auth", {"user": "taylor"})

return Inertia.render("Settings/Index", {
    "auth.locale": "en",  # props.auth == {"user": "taylor", "locale": "en"}
})
```

A dot key under a value that isn't a dict raises a `TypeError`.

## Shared Data

Shared data is sent as props to every page. Use it for values like the current user or the application name. Register it with `Inertia.share()` in a provider's `boot()` method:

```python
# providers/app_provider.py
from fastapi_startkit.inertia import Inertia
from fastapi_startkit.support import Provider


class AppProvider(Provider):
    def boot(self) -> None:
        Inertia.share("app_name", "PingCRM")

        Inertia.share("auth", lambda request: {
            "user": getattr(request.state, "user", None),
        })
```

A callable is called for each request. If it takes an argument, it receives the request. To share several values at once, pass a dict:

```python
Inertia.share({"app_name": "PingCRM", "locale": "en"})
```

Shared data is merged with the props you pass to `render()`. When a key is in both, the prop you pass to `render()` wins.

### Sharing During a Request

When you call `Inertia.share()` while a request is being handled, for example in a controller or a dependency, the value is shared with that response only:

```python
async def edit():
    Inertia.share("can_delete", True)
    return Inertia.render("Users/Edit")
```

### Shared Prop Keys

The page lists the top-level keys of shared data in `sharedProps`, so the client can tell shared props from page props. To leave the list out:

```python
Inertia.expose_shared_prop_keys(False)
```

## Partial Reloads

Wrap a prop in a callable so it's only resolved when the response includes it. On a partial reload, the client asks for some props, and the others aren't resolved at all. A `lambda` can't be async, so use an `async def` for async work:

```python
from fastapi_startkit.inertia import Inertia


async def load_users():
    return [{"id": 1, "name": "Alice"}]


async def load_organizations():
    return [{"id": 1, "name": "Acme"}]


async def index():
    return Inertia.render("Users/Index", {
        "users": load_users,
        "organizations": load_organizations,
    })
```

If the callable takes one argument, it receives the current request:

```python
return Inertia.render("Users/Index", {
    "path": lambda request: request.url.path,
})
```

Callables run one at a time, in the order of the props.

On the client, ask for some props with `only`, or for everything except some props with `except`:

```tsx
import { router } from '@inertiajs/react'

router.reload({ only: ['users'] })
router.reload({ except: ['organizations'] })
```

When a request sends both, `except` wins. Both accept dot paths, so you can reload one nested prop:

```tsx
router.reload({ only: ['auth.user'] })    // props.auth == { user: ... }
router.reload({ except: ['auth.token'] }) // everything except auth.token
```

Asking for a parent, such as `only: ['auth']`, returns all of its children. A partial reload only applies when the client is still on the same component. Otherwise, the server sends every prop.

## Prop Types

Wrap a value with one of the `Inertia` helpers to change when it's sent and how the client uses it. Each helper returns a `Prop`, and you can chain its methods:

| Helper | Behaviour |
|---|---|
| `Inertia.optional(callback)` | Left out of full visits. Sent only on a partial reload that includes it. |
| `Inertia.always(value)` | Always sent, even when a partial reload leaves it out. |
| `Inertia.defer(callback, group="default")` | Left out of the first render. The client loads it right after. |
| `Inertia.merge(value)` | Appended to the value the client already has. |
| `Inertia.deep_merge(value)` | Deep-merged into the value the client already has. |
| `Inertia.once(callback)` | Resolved once and remembered by the client. |
| `Inertia.scroll(page)` | A paginated result for infinite scrolling. |

`Prop` is exported too, so you can combine options yourself:

```python
from fastapi_startkit.inertia import Prop

return Inertia.render("Dashboard/Index", {
    "stats": Prop(load_stats).defer("sidebar").rescue(),
})
```

### Optional Props

`Inertia.optional()` leaves a prop out of full visits. It's sent only on a partial reload that names it in `only`, or on an `except` reload that doesn't exclude it:

```python
return Inertia.render("Users/Index", {
    "users": Inertia.optional(load_users),
})
```

### Always Props

`Inertia.always()` props are sent on every response, even when a partial reload's `only` or `except` would leave them out. When the value is a dict, all of its children are sent too:

```python
return Inertia.render("Users/Index", {
    "users": load_users,
    "auth": Inertia.always({"user": user, "team": team}),
})
```

The `errors` prop is an always prop. See [Validation Errors](#validation-errors).

### Deferred Props

Deferred props let a page appear quickly and fill in slow data afterwards. They're left out of the first render and listed in `deferredProps`, and the client loads them with a partial reload. Props in the same group are loaded together, one request per group:

```python
return Inertia.render("Dashboard/Index", {
    "user": user,
    "stats": Inertia.defer(load_stats),
    "chart": Inertia.defer(load_chart, group="sidebar"),
    "feed": Inertia.defer(load_feed, group="sidebar"),
})
# deferredProps == {"default": ["stats"], "sidebar": ["chart", "feed"]}
```

On the client, the `Deferred` component shows a fallback until the props arrive:

```tsx
import { Deferred } from '@inertiajs/react'

<Deferred data="stats" fallback={<div>Loading...</div>}>
    <Stats />
</Deferred>
```

### Merge Props

A reload normally replaces a prop. A merge prop is combined with the value the client already has instead, which suits "load more" lists:

```python
return Inertia.render("Posts/Index", {
    "posts": Inertia.merge(posts),                    # appended to the list
    "notifications": Inertia.merge(items).prepend(),  # added to the front
})
```

For a dict, choose which nested lists to merge with `append_at()` and `prepend_at()`:

```python
"feed": Inertia.merge({"data": items, "meta": meta}).append_at("data").prepend_at("meta.items"),
```

`match_on()` names the key that identifies an item, so the client updates items it already has instead of adding them twice:

```python
"posts": Inertia.merge(posts).match_on("id"),
```

To merge a nested structure recursively, use `deep_merge()`:

```python
"settings": Inertia.deep_merge({"notifications": {"email": True}}).match_on("items.id"),
```

You can combine merging with deferral, as in `Inertia.defer(load_posts).merge()`. When the client resets a prop with `router.reload({ reset: ['posts'] })`, the server sends it without merge metadata, so the client replaces it.

### Once Props

A once prop is resolved on the first visit and remembered by the client. Use it for data that rarely changes, such as plans or countries. On later visits, the client sends the keys it already has, and the server skips them:

```python
from datetime import timedelta

return Inertia.render("Billing/Index", {
    "plans": Inertia.once(load_plans),
    "countries": Inertia.once(load_countries).once_as("geo").until(60),
    "rates": Inertia.once(load_rates).until(timedelta(minutes=5)).fresh(),
})
```

You can chain three methods:

- `once_as(key)` stores the prop under your own key, so pages that use the same key share the value.
- `until(ttl)` sets an expiry, in seconds or as a `timedelta`. After it, the client loads the prop again.
- `fresh()` always resolves the prop, and still tells the client to remember it.

Once props can be deferred, as in `Inertia.defer(load_plans).once()`. A full page load resolves non-deferred once props again, even if the client already has them. Deferred once props are listed in `deferredProps` and loaded afterwards like any deferred prop.

### Scroll Props

For infinite scrolling, wrap a paginated result in `Inertia.scroll()`. The prop is serialized and listed in `scrollProps` with its previous, next and current page, so the client can load more and merge the new items. This example needs a database:

```python
async def index(page: int = 1):
    users = await User.query().paginate(15, page)
    return Inertia.render("Users/Index", {
        "users": Inertia.scroll(users),
    })
```

Any object with `current_page`, `previous_page` and `next_page` attributes works, including the ORM's paginators. New items are merged at `users.data`, or prepended when the client scrolls up. If the items are under a different key, call `wrapper("items")`.

When the value doesn't carry its own pagination details, pass a `ScrollMetadata`:

```python
from fastapi_startkit.inertia import ScrollMetadata


async def index(page: int = 1):
    async def load_logs():
        return {"data": await fetch_logs(page)}

    return Inertia.render("Logs/Index", {
        "logs": Inertia.scroll(load_logs, ScrollMetadata.pages("page", current_page=page, last_page=4)),
    })
```

For cursor pagination, use `ScrollMetadata.cursors("cursor", previous=None, next=next_cursor)`. An object can also provide its own details with a `scroll_metadata()` method that returns a `ScrollMetadata`, and `Inertia.scroll_with(callback)` wraps a callable that returns a paginated result.

### Rescuing Failed Props

When a prop raises an exception, the whole response fails. Mark a prop with `rescue()` to drop it instead. The error is logged and the prop's path is listed in `rescuedProps`, so the rest of the page still renders:

```python
from fastapi_startkit.inertia import Inertia, Prop

return Inertia.render("Dashboard/Index", {
    "user": user,
    "stats": Inertia.defer(load_stats).rescue(),
    "chart": Prop(load_chart).rescue(),
})
```

## Redirects

To send the user to another page, return `Inertia.redirect()`. The status defaults to `302`:

```python
from fastapi_startkit.inertia import Inertia


async def update(user_id: int):
    return Inertia.redirect(f"/users/{user_id}")
```

To send the user back to the previous page, return `Inertia.back()`. It follows the `Referer` header when it's on the same origin, and falls back to `/`:

```python
async def update():
    return Inertia.back()
```

Both return an `InertiaRedirect`, which can carry [flash data](#flash-data), [errors](#validation-errors) and [history flags](#history-encryption) to the next page:

```python
return Inertia.redirect("/users").flash("success", "User created")
```

For Inertia `PUT`, `PATCH` and `DELETE` requests, the middleware turns a `302` into a `303`, so the browser follows it with a `GET`.

### External Redirects

To leave the Inertia app, for example to go to a payment page, return `Inertia.location()`. For Inertia requests, it sends a `409` with an `X-Inertia-Location` header, and the client does a full browser visit. For other requests, it sends a `302`:

```python
async def checkout():
    return Inertia.location("https://checkout.example.com/session/123")
```

## Flash Data

Flash data is shown once on the next page and then discarded, which suits messages like "User created". It's sent in the page's `flash` key, not as a prop:

```python
async def store():
    Inertia.flash("success", "User created")
    return Inertia.redirect("/users")
```

`flash()` takes a key and value or a dict. You may also call it on a redirect or on a response:

```python
return Inertia.redirect("/users").flash({"success": "User created"})

return Inertia.render("Users/Index").flash("toast", "Saved")
```

Flash data survives redirects, including the ones the middleware changes, and asset version reloads.

## Validation Errors

When a form fails validation, send the user back with the errors. The errors are kept in the session and sent as the `errors` prop on the next page, with the first message for each field:

```python
async def update():
    return Inertia.back_with_errors({"email": "The email is required."})
# next page: props.errors == {"email": "The email is required."}
```

You may also queue errors with `Inertia.with_errors()`, or add them to any redirect:

```python
Inertia.with_errors({"email": "The email is required."})

return Inertia.redirect("/users/create").with_errors({"name": ["Taken", "Too short"]})
```

Errors can be a dict of strings or lists, a `ValidationErrors` object, a Pydantic `ValidationError` or FastAPI's `RequestValidationError`. For a `RequestValidationError`, the first part of each error location, such as `body` or `query`, is dropped, so `("body", "user", "email")` becomes `user.email`:

```python
from fastapi import Request
from pydantic import ValidationError


async def store(request: Request):
    try:
        form = UserForm.model_validate(dict(await request.form()))
    except ValidationError as e:
        return Inertia.back_with_errors(e)
    return Inertia.redirect("/users")
```

When you register `FastAPIProvider`, you don't need to catch request validation errors yourself. If a route's request model fails validation on an Inertia request, the response is a `303` back to the previous page with the errors queued. Other requests still get a `422` JSON response. See [Validation](/docs/validation) for the rules.

To build errors yourself, use `ValidationErrors`:

```python
from fastapi_startkit.inertia import ValidationErrors

errors = ValidationErrors({"email": "Required"}).add("email", "Invalid").merge({"name": ["Taken"]})

errors.has("email")    # True
errors.first("email")  # "Required"
errors.get("email")    # ["Required", "Invalid"]
errors.all()           # {"email": ["Required", "Invalid"], "name": ["Taken"]}
errors.firsts()        # {"email": "Required", "name": "Taken"}
```

### Error Bags

When a page has several forms, put each form's errors in a named bag:

```python
return Inertia.back_with_errors({"email": "Required"}, bag="login")

# or
Inertia.with_errors_in("login", {"email": "Required"})
return Inertia.redirect("/").with_errors_in("register", {"name": "Taken"})
# props.errors == {"login": {...}, "register": {...}}
```

The client can choose the bag too. When the request that renders the page sends `errorBag: 'login'` (the `X-Inertia-Error-Bag` header), errors in the default bag are nested under that name, as in `{"login": {"email": "Required"}}`.

### Errors on Partial Reloads

`errors` is an always prop, so it's sent on partial reloads too. It only holds errors queued since the last render, so a partial reload with no new errors gets `{}`. Errors go to the next Inertia render, whichever component it renders.

## History Encryption

Inertia can encrypt the page data it stores in the browser's history, so it can't be read after the user logs out. To turn it on for every page, call `Inertia.encrypt_history()` in a provider's `boot()` method:

```python
# providers/app_provider.py
class AppProvider(Provider):
    def boot(self) -> None:
        Inertia.encrypt_history()
```

You may also turn it on or off for one response:

```python
return Inertia.render("Billing/Index").encrypt_history()
return Inertia.render("Public/Index").encrypt_history(False)
```

Calling `Inertia.encrypt_history()` during a request affects that request only.

To clear the encrypted history, for example when a user logs out, call `clear_history()`. It applies to the next page:

```python
async def logout():
    Inertia.clear_history()
    return Inertia.redirect("/login")

# or
return Inertia.redirect("/login").clear_history()
```

### Preserving the URL Fragment

A redirect drops the `#fragment` of the current URL. To keep it on the next page, call `preserve_fragment()`:

```python
return Inertia.redirect("/users/1").preserve_fragment()
```

## Asset Versioning

When you deploy new assets, Inertia tells clients that their bundle is out of date. With `ViteProvider` registered, the asset version is a hash of the Vite manifest, so this works without setup.

To set the version yourself, call `Inertia.version()` in a provider's `boot()` method. It takes a string, or a callable that's called once per request:

```python
# providers/app_provider.py
class AppProvider(Provider):
    def boot(self) -> None:
        Inertia.version("1.0.0")
```

A version you set is used instead of the Vite manifest hash.

When the client's `X-Inertia-Version` header doesn't match on a `GET` request, the middleware returns `409 Conflict` with `X-Inertia-Location` and `X-Inertia-Version` headers before your controller runs, and the client does a full reload. Flash data and errors are kept for the reloaded page.

## Root View

The root template defaults to `index.html`. To use another template, call `Inertia.set_root_view()` in a provider's `boot()` method:

```python
Inertia.set_root_view("app.html")
```

A single response can use its own template, and pass extra values to it with `with_view_data()`:

```python
return Inertia.render("Reports/Print").with_root_view("print.html").with_view_data("title", "Report")
```

## Server-Side Rendering

With server-side rendering (SSR), the first visit's HTML includes the rendered page, so it shows before your JavaScript loads. You run the Inertia SSR server from your JavaScript build, and the framework sends each first visit to it. See the [Inertia SSR guide](https://inertiajs.com/server-side-rendering) for the client side.

Turn it on in a provider's `boot()` method. The URL defaults to `http://127.0.0.1:13714`:

```python
# providers/app_provider.py
class AppProvider(Provider):
    def boot(self) -> None:
        Inertia.ssr("http://127.0.0.1:13714", except_paths=["/admin/*"])
```

The rendered body goes inside the <code v-pre>{{ inertia(page) }}</code> element, and the head tags are output by <code v-pre>{{ inertia_head(page) }}</code>. If the SSR server fails or doesn't respond within the `timeout` (1 second by default), the page is rendered on the client instead. Inertia requests from the client are never sent to the SSR server.

During development, `Inertia.ssr_hot("public/hot")` sends pages to the Vite dev server named in the hot file instead. The dev server renders them when your Vite config uses the `@inertiajs/vite` plugin. To render one response on the client, call `without_ssr()` on it. To check that the SSR server is up, `await Inertia.ssr_healthy()` returns `True` or `False`.

## Middleware

`InertiaProvider` registers `InertiaMiddleware`. For Inertia requests, it does the following:

1. Returns a `409` when the asset version doesn't match, so the client does a full reload.
2. Turns a `302` into a `303` for `PUT`, `PATCH` and `DELETE` requests.
3. Turns an empty `200` response into a redirect back to the previous page.
4. Turns a redirect to a URL with a `#fragment` into a `409` with an `X-Inertia-Redirect` header, so the client keeps the fragment. Prefetch requests are left alone.

On every request, it shares the `errors` prop and adds `X-Inertia` to the `Vary` header.

Shared props, the version, the root view and the history flags set during a request belong to that request only, so concurrent requests don't see each other's values.

## Testing

Flash data, errors and history flags are kept in the session. In your tests, add `FakeSessionMiddleware` to get an in-memory session that lasts between requests, and use `assert_inertia()` to check the page:

```python
# tests/test_users.py
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from fastapi_startkit.inertia import Inertia, InertiaMiddleware
from fastapi_startkit.inertia.testing import FakeSessionMiddleware, assert_inertia


@pytest.fixture
def inertia_version():
    Inertia.version("test")
    yield
    Inertia.version(None)


def test_flash_appears_on_the_next_page(inertia_version):
    app = FastAPI()
    app.add_middleware(InertiaMiddleware)
    app.add_middleware(FakeSessionMiddleware)

    @app.post("/users")
    async def store():
        return Inertia.redirect("/users").flash("success", "User created")

    @app.get("/users")
    async def index():
        return Inertia.render("Users/Index", {
            "users": [{"name": "Alice"}],
            "stats": Inertia.defer(lambda: {"total": 1}),
        })

    client = TestClient(app)
    client.post("/users", follow_redirects=False)
    response = client.get("/users", headers={"X-Inertia": "true", "X-Inertia-Version": "test"})

    (
        assert_inertia(response)
        .component("Users/Index")
        .has_count("users", 1)
        .equals("users.0.name", "Alice")
        .deferred("default", ["stats"])
        .flash("success", "User created")
    )
```

The `inertia_version` fixture sets a fixed asset version, because this FastAPI app runs without a booted application to provide the Vite manifest hash. It resets the version afterwards so it doesn't leak into other tests. To seed or inspect the session, pass your own dict as `session=`.

`assert_inertia()` also provides `url()`, `version()`, `has()` and `missing()`. Paths use dots, and numbers index into lists.

::: warning
`FakeSessionMiddleware` is for tests only. Use a real session middleware, such as Starlette's `SessionMiddleware`, in your application.
:::

Related pages: [Vite](/docs/frontend/vite), [Validation](/docs/validation).
