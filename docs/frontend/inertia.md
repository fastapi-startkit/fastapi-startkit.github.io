---
outline: deep
title: Inertia
description: Build single-page applications with Inertia.js and FastAPI Startkit, without writing a separate API.
keywords: inertia, spa, frontend, fastapi, monolithic
---

# Inertia

[Inertia.js](https://inertiajs.com) lets you build a single-page app with server-side routing and controllers, without writing a separate API. Your controllers return a component name and props, and a React, Vue, or Svelte component renders the page. You get the snappy feel of an SPA while keeping routing, authorization, and data loading on the server, where they're easy to reason about.

FastAPI Startkit's Inertia support lives in `InertiaProvider`. It binds the `Inertia` renderer to the container, registers `InertiaMiddleware`, and injects the <code v-pre>{{ inertia(page) }}</code> Jinja2 helper into your templates.

## Setup

### Server-Side Setup
To get started, register `InertiaProvider` after `ViteProvider`, since Vite provides the Jinja2 templates Inertia renders into:

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

With the provider in place, your controllers can return `Inertia.render()`:
```python
from fastapi_startkit.inertia import Inertia

async def index():
    return Inertia.render("Dashboard/Index")
```

### Client-Side Setup
Inertia relies on Vite for asset bundling, so if you haven't set it up yet, follow the [Vite docs](/docs/frontend/vite) first.

This guide uses React. Start by installing the Inertia React adapter, React, and its Vite plugin:

```bash
npm install @inertiajs/react react react-dom @vitejs/plugin-react
```

Then install the React type definitions:

```bash
npm i --save-dev @types/react-dom @types/react
```

Next, add the React plugin and the new entry point to `vite.config.ts`:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // [!code ++]
import fastapi from 'fastapi-vite-plugin'

export default defineConfig({
    plugins: [
        fastapi({
            input: 'resources/js/app.tsx',  // [!code ++]
            refresh: true,
        }),
        react(), // [!code ++]
        // ...
    ],
})
```

#### Entry point (`resources/js/app.tsx`)

```tsx
import '../css/app.css'
import { createInertiaApp } from "@inertiajs/react"
import { createRoot } from "react-dom/client"

// @ts-ignore
const appName = import.meta.env.VITE_APP_NAME || "My App"

await createInertiaApp({
    title: title => `${title} - ${appName}`,
    resolve: name => {
        // @ts-ignore
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

Finally, add a page component under `resources/js/Pages`:

```tsx
// resources/js/Pages/Dashboard/Index.tsx
export default function Dashboard() {
    return (
        <div>
            <p>Hello from Fastapi Startkit</p>
        </div>
    )
}
```

### Root Template

Every first visit is rendered through a root template, so create `resources/templates/index.html`. The <code v-pre>{{ inertia(page) }}</code> helper renders the bootstrap `<script>` tag and the `<div id="app">` mount point:

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

## Passing Props

`Inertia.render()` takes the component name and an optional props dict. Notice that you don't pass the request; `InertiaMiddleware` keeps the current request in a context variable for you.

```python
from fastapi_startkit.inertia import Inertia

async def index():
    return Inertia.render("Dashboard/Index", {
        "user": {"name": "Alice"},
    })
```

When there are no props, you can leave out the second argument:

```python
async def index():
    return Inertia.render("Dashboard/Index")
```

You can also add props to an existing response with `with_()`, which takes either a key and value or a dict:

```python
return Inertia.render("Dashboard/Index").with_("user", user).with_({"stats": stats})
```

On the first page load, the response is HTML rendered from the root template. On Inertia requests (those with the `X-Inertia: true` header), it's JSON with the component name, props, and URL.

### Nested Props

Props can be nested dicts, and each level is resolved recursively, so a callable or a [prop type](#prop-types) works at any depth:

```python
return Inertia.render("Dashboard/Index", {
    "auth": {
        "user": lambda: current_user(),
        "permissions": Inertia.defer(load_permissions),
    },
})
```

A key containing a dot is expanded into the nested structure. This lets you add one value under a shared prop without replacing the whole thing:

```python
Inertia.share("auth", {"user": "taylor"})

return Inertia.render("Settings/Index", {
    "auth.locale": "en",  # props.auth == {"user": "taylor", "locale": "en"}
})
```

Using a dot key under a value that isn't a dict raises a `TypeError`.

## Shared Data

Some data, like the current user or the app name, belongs on every page. Shared data is sent as props to every page, and you register it by calling `share()` in a provider's `boot()` method:

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
```

If you have several values to share, `share()` also accepts a dict:

```python
Inertia.share({"app_name": "PingCRM", "locale": "en"})
```

If you prefer working with the container, its `inertia` binding resolves to the same API:

```python
inertia = self.app.make("inertia")
inertia.share("app_name", "PingCRM")
```

Shared data is merged with per-render props, and when the two collide, the per-render props win.

### Sharing During a Request

When you call `Inertia.share()` while a request is being handled, such as in a controller or a dependency, it only affects that request and won't leak into later ones:

```python
from fastapi import Request

async def edit(request: Request):
    Inertia.share("only_here", True)  # visible on this response only
    return Inertia.render("Users/Edit")
```

Shares made in `boot()`, by contrast, reach every page.

### Shared Prop Keys

The page object lists the top-level keys of shared data in `sharedProps`, so the client can tell shared props from page props. If you don't need this, you can turn it off:

```python
Inertia.expose_shared_prop_keys(False)
```

## Partial Reloads

Wrap a prop in a callable and it's resolved lazily, so a partial reload only evaluates the keys it asks for. Since a `lambda` can't be async, use a named `async def` for async props:

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

If your callable takes one argument, it receives the current request:

```python
return Inertia.render("Page", {
    "path": lambda request: request.url.path,
})
```

Callables are resolved one at a time, in order, which means async ORM calls never share a database session concurrently.

On the client, you can request only some props with `only`, or everything except some props with `except`:

```tsx
import { router } from "@inertiajs/react"

router.reload({ only: ["users"] })
router.reload({ except: ["companies"] })
```

These map to the `X-Inertia-Partial-Data` and `X-Inertia-Partial-Except` headers. When both are sent, `except` wins. Both match dot paths, so you can reload a single nested prop:

```tsx
router.reload({ only: ["auth.user"] })            // props.auth == { user: ... }
router.reload({ except: ["auth.token"] })         // everything except auth.token
```

Requesting a parent (`only: ["auth"]`) returns all of its children. Keep in mind that a partial reload only applies to the component that sent it; if the client is on a different component, the server renders a full visit.

## Prop Types

Not every prop needs to be sent the same way. Wrap a value with one of the `Inertia` helpers to change how and when it's sent. Each helper returns a `Prop`, and you can chain its options:

| Helper | Behaviour |
|---|---|
| `Inertia.optional(callback)` | Skipped on full visits; sent only on a partial reload that includes it |
| `Inertia.always(value)` | Always sent, even when a partial reload excludes it |
| `Inertia.defer(callback, group="default")` | Skipped on the first render, loaded right after by the client |
| `Inertia.merge(value)` | Appended to the existing client-side value instead of replacing it |
| `Inertia.deep_merge(value)` | Deep-merged into the existing client-side value |
| `Inertia.once(callback)` | Resolved once and remembered by the client |
| `Inertia.scroll(page)` | Paginated data for infinite scrolling |

`Prop` is exported as well, so you can build any combination yourself:

```python
from fastapi_startkit.inertia import Prop

"stats": Prop(load_stats).defer("sidebar").rescue()
```

### Optional Props

Use `Inertia.optional()` to leave a prop out of full visits. It's only sent on a partial reload that includes it, either by naming it in `only` or by an `except`-only reload that doesn't exclude it:

```python
async def index():
    async def get_users():
        return await User.all()

    return Inertia.render('Users/Index', {
        'users': Inertia.optional(get_users),
    })
```

### Always Props

`Inertia.always()` props are included on every response, even when a partial reload's `only` or `except` would exclude them. When the value is a dict, all of its children are included too:

```python
return Inertia.render("Users/Index", {
    "users": get_users,
    "auth": Inertia.always({"user": user, "team": team}),
})
```

The built-in `errors` prop is an always prop; see [Validation Errors](#validation-errors) for details.

### Deferred Props

Deferred props are a nice way to get a page on screen quickly and fill in slower data afterwards. They're left out of the first render; the page lists them in `deferredProps`, and the client fetches them in a follow-up partial reload. Props in the same group are fetched together, and each group is a separate request:

```python
return Inertia.render("Dashboard/Index", {
    "user": user,
    "stats": Inertia.defer(get_stats),
    "chart": Inertia.defer(get_chart, group="sidebar"),
    "feed": Inertia.defer(get_feed, group="sidebar"),
})
# deferredProps == {"default": ["stats"], "sidebar": ["chart", "feed"]}
```

On the client, use the `Deferred` component to render a placeholder until they arrive:

```tsx
import { Deferred } from "@inertiajs/react"

<Deferred data="stats" fallback={<div>Loading...</div>}>
    <Stats />
</Deferred>
```

### Merge Props

By default, a reload replaces a prop. A merge prop, on the other hand, is combined with the value the client already has, which makes it a good fit for "load more" lists:

```python
return Inertia.render("Posts/Index", {
    "posts": Inertia.merge(posts),                    # append to the existing list
    "notifications": Inertia.merge(items).prepend(),  # add to the front
})
```

For a dict, you can choose which nested lists to merge with `append_at()` and `prepend_at()`:

```python
"feed": Inertia.merge({"data": items, "meta": meta}).append_at("data").prepend_at("meta.items")
```

`match_on()` tells the client which key identifies an item, so items that are already present are updated instead of duplicated:

```python
"posts": Inertia.merge(posts).match_on("id")
```

To recursively merge a nested structure, use `deep_merge()`:

```python
"settings": Inertia.deep_merge({"notifications": {"email": True}}).match_on("items.id")
```

Merging can be combined with deferral, for example `Inertia.defer(load_posts).merge()`. When the client asks to reset a prop (`router.reload({ reset: ["posts"] })`), the server sends it without merge metadata so the client replaces it.

### Once Props

Some data rarely changes, like a list of plans or countries. A once prop is resolved on the first visit and remembered by the client. On later visits, the client sends the keys it already has, and the server skips them:

```python
from datetime import timedelta

return Inertia.render("Billing/Index", {
    "plans": Inertia.once(get_plans),
    "countries": Inertia.once(get_countries).once_as("geo").until(60),
    "rates": Inertia.once(get_rates).until(timedelta(minutes=5)).fresh(),
})
```

There are three modifiers you can chain. `once_as(key)` stores the prop under a custom key, so pages that use the same key share the value. `until(ttl)` sets an expiry, in seconds or as a `timedelta`, after which the client refetches the prop. And `fresh()` always resolves the prop, while still telling the client to remember it.

Once props can be deferred too, as in `Inertia.defer(get_plans).once()`. A full page load (the first HTML response) resolves non-deferred once props again, even if the client already has them. Deferred once props are not resolved on a full page load; they are listed in `deferredProps` and fetched afterwards like any deferred prop.

### Scroll Props

For infinite scrolling, `Inertia.scroll()` sends a paginated result. It serializes the page and adds `scrollProps` with the previous, next and current page, so the client can load more and merge the new items:

```python
async def index(page: int = 1):
    users = await User.query().paginate(15, page)
    return Inertia.render("Users/Index", {
        "users": Inertia.scroll(users),
    })
```

Any object with `current_page`, `previous_page` and `next_page` attributes works, including the ORM's paginators. The items are merged at `users.data`, and when the client scrolls upwards, they're prepended instead. If the items live under a different key, use `wrapper()`.

When the value doesn't carry its own pagination details, pass a `ScrollMetadata`:

```python
from fastapi_startkit.inertia import ScrollMetadata

"logs": Inertia.scroll(logs, ScrollMetadata.pages("logs", current_page=1, last_page=4)),
"feed": Inertia.scroll(feed, ScrollMetadata.cursors("cursor", previous=None, next=next_cursor)),
```

If you'd like to resolve the page lazily, use `Inertia.scroll_with(callback)`. An object can also provide its own details through a `scroll_metadata()` method that returns a `ScrollMetadata`.

### Rescuing Failed Props

Normally, if a prop raises an exception, the whole response fails. Mark a prop with `rescue()` and it's dropped instead: the error is logged and the prop's path is listed in `rescuedProps`, so the rest of the page still renders:

```python
from fastapi_startkit.inertia import Inertia, Prop

return Inertia.render("Dashboard/Index", {
    "user": user,
    "stats": Inertia.defer(get_stats).rescue(),
    "chart": Prop(get_chart).rescue(),
})
```

## Redirects

To send the user somewhere else, return `Inertia.redirect()`. Its status defaults to `302`:

```python
from fastapi_startkit.inertia import Inertia

async def store():
    user = await User.create(...)
    return Inertia.redirect(f"/users/{user.id}")
```

When you just want to send the user back where they came from, `Inertia.back()` redirects to the previous page using the `Referer` header. Only same-origin referers are followed; anything else falls back to `/`:

```python
async def update():
    ...
    return Inertia.back()
```

Both methods return an `InertiaRedirect`, which can carry [flash data](#flash-data), [errors](#validation-errors) and [history flags](#history-encryption) for the next page:

```python
return Inertia.redirect("/users").flash("success", "User created")
```

### External Redirects

To leave the Inertia app entirely, for example to go to a payment provider, use `Inertia.location()`. For Inertia requests it sends `409` with an `X-Inertia-Location` header, which makes the client do a full browser visit. For normal requests it sends a `302`:

```python
async def checkout():
    return Inertia.location("https://checkout.example.com/session/123")
```

## Flash Data

Flash data is perfect for one-off messages like "User created". It's shown once on the next page and then discarded, and it's sent as the page's `flash` key rather than as a prop:

```python
async def store():
    Inertia.flash("success", "User created")
    return Inertia.redirect("/users")
```

`flash()` accepts either a key and value or a dict. It's also available on `InertiaRedirect` and on an Inertia response:

```python
return Inertia.redirect("/users").flash({"success": "User created"})

return Inertia.render("Users/Index").flash("toast", "Saved")
```

Flash data survives redirects, including the ones the middleware converts, as well as asset version reloads.

## Validation Errors

When a form submission fails validation, you'll usually want to send the user back with the errors. Errors are flashed to the session and shared as the `errors` prop on the next page, with each field showing its first message:

```python
async def update():
    ...
    return Inertia.back_with_errors({"email": "The email is required."})
# next page: props.errors == {"email": "The email is required."}
```

You can also flash errors with `Inertia.with_errors()`, or attach them to any redirect:

```python
Inertia.with_errors({"email": "The email is required."})

return Inertia.redirect("/users/create").with_errors({"name": ["Taken", "Too short"]})
```

You can supply errors as a dict of strings or lists, a `ValidationErrors` object, a pydantic `ValidationError`, or FastAPI's `RequestValidationError`. For a `RequestValidationError`, the first segment of each error location (such as `body` or `query`) is dropped, so `("body", "user", "email")` becomes `user.email`:

```python
from fastapi import Request
from pydantic import ValidationError

async def store(request: Request):
    try:
        data = UserForm.model_validate(dict(await request.form()))
    except ValidationError as e:
        return Inertia.back_with_errors(e)
    ...
```

If you need to build errors yourself, `ValidationErrors` is a small helper for doing just that:

```python
from fastapi_startkit.inertia import ValidationErrors

errors = ValidationErrors({"email": "Required"}).add("email", "Invalid").merge({"name": ["Taken"]})

errors.has("email")   # True
errors.first("email") # "Required"
errors.get("email")   # ["Required", "Invalid"]
errors.all()          # {"email": ["Required", "Invalid"], "name": ["Taken"]}
errors.firsts()       # {"email": "Required", "name": "Taken"}
```

### Error Bags

When a page has several forms, you can put each form's errors in a named bag so they don't mix:

```python
return Inertia.back_with_errors({"email": "Required"}, bag="login")

# or
Inertia.with_errors_in("login", {"email": "Required"})
return Inertia.redirect("/").with_errors_in("register", {"name": "Taken"})
# props.errors == {"login": {...}, "register": {...}}
```

The client can choose the bag too. When a request sends `errorBag: "login"` (the `X-Inertia-Error-Bag` header), default-bag errors are nested under that name, for example `{"login": {"email": "Required"}}`.

### Errors on Partial Reloads

Because `errors` is an always prop, it's included on partial reloads too. It only contains errors flashed since the last render, so a partial reload with no new errors gets `{}` and old errors don't stick to the page. Errors are delivered on the next Inertia render, whichever component that happens to be.

## History Encryption

Inertia can encrypt the page data stored in the browser's history, so it can't be read after the user logs out. To turn it on for every page, call `encrypt_history()` in a provider:

```python
class FastAPIProvider(BaseFastAPIProvider):
    def boot(self) -> None:
        super().boot()
        Inertia.encrypt_history()
```

You can also enable it per response, which lets a single page opt out as well:

```python
return Inertia.render("Billing/Index").encrypt_history()
return Inertia.render("Public/Index").encrypt_history(False)
```

As with sharing, calling `Inertia.encrypt_history()` during a request only affects that request.

To clear the encrypted history, for example when a user logs out, call `clear_history()`. It applies to the next page:

```python
async def logout():
    Inertia.clear_history()
    return Inertia.redirect("/login")

# or
return Inertia.redirect("/login").clear_history()
```

### Preserving the URL Fragment

By default, a redirect drops the `#fragment` of the current URL. If you want to keep it on the next page, call `preserve_fragment()`:

```python
return Inertia.redirect("/users/1").preserve_fragment()
```

## Asset Versioning

When you deploy new assets, Inertia needs a way to tell clients their bundle is out of date. If `ViteProvider` is registered, `InertiaMiddleware` uses the Vite manifest hash as the asset version, so this works without any extra setup.

If you'd rather set the version yourself, call `Inertia.version()` in a provider's `boot()` method. It takes a string or a callable, which is evaluated once per request:

```python
from fastapi_startkit.inertia import Inertia

class FastAPIProvider(BaseFastAPIProvider):
    def boot(self) -> None:
        super().boot()
        Inertia.version("1.0.0")
```

Once a version is configured, it's used instead of the Vite manifest hash.

When the client's `X-Inertia-Version` header doesn't match the server version on a `GET` request, the middleware returns `409 Conflict` with `X-Inertia-Location` and `X-Inertia-Version` headers before the controller runs, and the client performs a full hard reload. Flash data and errors are kept for the reloaded page.

## Root View

The root template defaults to `index.html`. To use a different name, change it in a provider's `boot()` method:

```python
from fastapi_startkit.inertia import Inertia

Inertia.set_root_view("app.html")
```

The configured root view is used for every first visit, though a single response can still use its own template:

```python
return Inertia.render("Reports/Print").with_root_view("print.html")
```

## Middleware

`InertiaProvider` registers `InertiaMiddleware` for you. It takes care of the following:

1. Version check: returns `409` on version mismatch (triggers hard reload).
2. Redirect conversion: converts `302` redirects to `303` for Inertia `PUT`/`PATCH`/`DELETE` requests, so the browser performs a `GET` on the redirect target.
3. Empty responses: an empty `200` response to an Inertia request becomes a redirect back to the previous page.
4. Fragment redirects: a redirect to a URL with a `#fragment` becomes a `409` with an `X-Inertia-Redirect` header, so the client keeps the fragment. Prefetch requests are left alone.
5. Errors: shares the `errors` prop on every page.
6. Vary header: adds `X-Inertia` to the `Vary` header of every response, keeping any existing values.

Shared props, the per-request version and root view, and the history encryption flag all live in request-scoped state, so concurrent requests never see each other's data.

## Testing

Flash data, errors and history flags are stored in the session. Without a session middleware, they're kept for the current request only and a warning is logged. In your tests, add `FakeSessionMiddleware` to get an in-memory session that persists between requests:

```python
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi_startkit.inertia import Inertia, InertiaMiddleware
from fastapi_startkit.inertia.testing import FakeSessionMiddleware

@pytest.fixture
def inertia_version():
    Inertia.version("test")
    yield
    Inertia.version(None)

def test_flash_appears_on_the_next_page(inertia_version):
    session = {}
    app = FastAPI()
    app.add_middleware(InertiaMiddleware)
    app.add_middleware(FakeSessionMiddleware, session=session)

    @app.post("/save")
    async def save():
        return Inertia.redirect("/page").flash("success", "Saved")

    @app.get("/page")
    async def page():
        return Inertia.render("Page")

    client = TestClient(app)
    client.post("/save", follow_redirects=False)

    page = client.get("/page", headers={"X-Inertia": "true", "X-Inertia-Version": "test"}).json()
    assert page["flash"] == {"success": "Saved"}
```

The `inertia_version` fixture sets a fixed version, so this bare FastAPI app runs without a booted application (which would otherwise provide the Vite manifest hash), and it resets the version afterwards so it doesn't leak into other tests. You can pass your own dict as `session` to inspect or seed it. Remember that `FakeSessionMiddleware` is for tests only; use a real session middleware in your application.
