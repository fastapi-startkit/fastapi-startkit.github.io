# Vite

The `ViteProvider` integrates Vite asset bundling with your application. It supports both **HMR development mode** and **manifest-based production mode**, and injects `vite()`, `vite_asset()`, and `vite_react_refresh()` helpers into Jinja2 templates.

## Setup

Register `ViteProvider` in your application:

```python
# bootstrap/application.py
from fastapi_startkit.vite import ViteProvider

app = Application(
    base_path=...,
    providers=[
        ViteProvider,
        ...
    ],
)
```

Publish the default config file:

```bash
python artisan vendor:publish --provider=vite
```

This creates `config/vite.py` in your project.

---

## Configuration

`config/vite.py` uses a `ViteConfig` dataclass with these defaults:

```python
from fastapi_startkit.vite import ViteConfig

config = ViteConfig(
    public_path="public",       # Root directory for assets
    build_directory="build",    # Subfolder inside public_path for production build
    hot_file="hot",             # Presence of this file signals dev server is running
    manifest_filename="manifest.json",
    asset_url="",               # Optional CDN prefix for asset URLs
    static_url="/build",        # URL prefix used when mounting static files
    mount_static=True,          # Auto-mount public/build as a StaticFiles route
)
```

---

## Development Mode (HMR)

Start the Vite dev server:

```bash
npm run dev
```

When the `public/hot` file exists, the `Vite` class switches to HMR mode automatically. Asset tags point to the HMR server (default: `http://localhost:5173`) instead of the build directory.

The hot file's content is the HMR origin URL. Vite writes it automatically; you can also create it manually:

```
http://localhost:5173
```

---

## Production Mode

Build your assets:

```bash
npm run build
```

Vite writes `public/build/manifest.json`. The framework reads this manifest at startup (cached in memory) and generates hashed asset URLs with preload tags.

---

## Template Helpers

With Jinja2 templates registered (via `ViteProvider`), three globals are available:

### `vite(entrypoint)`

Generates `<script type="module">` and `<link rel="stylesheet">` tags plus `<link rel="modulepreload">` preloads for the given entry point:

::: v-pre
```html
{# templates/index.html #}
{{ vite('resources/js/app.tsx') }}
```
:::

Multiple entry points:

::: v-pre
```html
{{ vite(['resources/js/app.tsx', 'resources/css/admin.css']) }}
```
:::

### `vite_asset(path)`

Returns the public URL for a non-entry-point asset (images, fonts, etc.):

::: v-pre
```html
<img src="{{ vite_asset('resources/images/logo.png') }}">
```
:::

### `vite_react_refresh()`

Injects the React Fast Refresh preamble. Required for React HMR. Must appear **before** `vite()`:

::: v-pre
```html
{{ vite_react_refresh() }}
{{ vite('resources/js/app.tsx') }}
```
:::

In production mode, `vite_react_refresh()` returns an empty string — safe to always include.

---

## CSP Nonce

```python
vite = app.make("vite")
nonce = vite.use_csp_nonce()   # generates a random nonce
# pass nonce to template context, set it in your CSP header
```

All generated script and link tags will include the `nonce` attribute.

---

## Custom Asset URL Resolver

Override how asset URLs are built (e.g., to add a CDN prefix dynamically):

```python
vite = app.make("vite")
vite.create_asset_paths_using(lambda path: f"https://cdn.example.com/{path}")
```

---

## SRI Integrity

The manifest chunk key `"integrity"` is read by default and included as the `integrity` attribute on generated tags. Change the key or disable it:

```python
vite.use_integrity_key("sri")   # use a different key
vite.use_integrity_key(False)   # disable integrity attributes
```
