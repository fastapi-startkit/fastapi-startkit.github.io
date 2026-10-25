---
outline: deep
title: Vite
description: Use Vite to build and serve frontend assets in FastAPI Startkit, with HMR in development and fingerprinted assets in production.
keywords: vite, frontend, assets, fastapi, bundling
---

# Vite
[Vite](https://vitejs.dev) is a fast frontend build tool that compiles your JavaScript, CSS, and other assets for production. FastAPI Startkit ships with first-party Vite integration through `ViteProvider`, so you get hot module replacement (HMR) while you develop and manifest-based asset fingerprinting when you deploy. Your templates call one helper, and the framework figures out whether to point at the dev server or the built files.

## Example App

If you'd like to see everything wired up first, take a look at the [vite-app](https://github.com/fastapi-startkit/fastapi-startkit-framework/tree/main/example/vite-app) directory of the monorepo. It shows the complete setup: `ViteProvider` registration, config, Vite config, and a template using `vite()`.

## Setup

To get started, install the `vite` extra:

```bash
pip install "fastapi-startkit[vite]"
```

Then add `ViteProvider` to your application's providers list:

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

Next, publish the default config and asset files:

```bash
uv run python artisan provider:publish --provider=vite
```

This creates the following files in your project:

- `config/vite.py`: FastAPI configuration for Vite.
- `package.json`: Vite dependencies and scripts.
- `vite.config.ts`: Vite configuration with Tailwind CSS support.
- `tsconfig.json`: TypeScript configuration.
- `resources/js/app.ts`: Main entry point.
- `resources/css/app.css`: Main CSS entry point.
- `resources/templates/index.html`: Example template using Vite.

After publishing, install the frontend dependencies and start the development server:

```bash
npm install
npm run dev
```

> [!NOTE]
> Make sure `APP_URL` in your `.env` matches your FastAPI server URL (for example, `http://127.0.0.1:8000`) so that Vite's Hot Module Replacement (HMR) can communicate with the backend.

## Configuration

The published `config/vite.py` uses a `ViteConfig` dataclass with these defaults:

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
    template=True,              # Auto-bind Jinja2 templates (default)
    templates_directory="resources/templates",  # Directory the template engine reads from
)
```

To use your own configuration, register the provider as a tuple with your `ViteConfig` class. If you leave it out, the provider falls back to the defaults above.

```python
from config.vite import ViteConfig

app = Application(
    providers=[
        (ViteProvider, ViteConfig),
    ],
)
```

## Loading a Page with JS and CSS

`ViteProvider` sets up Jinja2 templates for you, so rendering a page is just a matter of resolving `templates` from the container and returning a `TemplateResponse`:

```python
from starlette.requests import Request

async def index(request: Request):
    from fastapi_startkit.application import app
    templates = app().make("templates")
    return templates.TemplateResponse(request, "index.html", {"title": "Home"})
```

Then, in your template, call `vite()` with the entry point to inject the JS and CSS tags:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>FastAPI + Vite</title>
    {{ vite('resources/js/app.ts') }}
</head>
<body>
    <h1>Hello from FastAPI + Vite</h1>
</body>
</html>
```

The `vite()`, `vite_asset()`, and `vite_react_refresh()` functions are all available as template globals. You'll find the details under [Template Helpers](#template-helpers).

## Development Mode (HMR)

During development, start the Vite dev server:

```bash
npm run dev
```

As long as the `public/hot` file exists, the `Vite` class switches to HMR mode automatically, and asset tags point to the HMR server (default: `http://localhost:5173`) instead of the build directory.

The hot file contains the HMR origin URL. Vite writes it for you, but you can also create it by hand:

```
http://localhost:5173
```

## Production Mode

When you're ready to deploy, build your assets:

```bash
npm run build
```

Vite writes a `public/build/manifest.json` file. The framework reads this manifest on first use, caches it in memory, and generates hashed asset URLs with preload tags.

## Template Helpers

Once `ViteProvider` has registered Jinja2 templates, three globals are available in every template:

### `vite(entrypoint)`

The `vite()` helper generates `<script type="module">` and `<link rel="stylesheet">` tags, plus `<link rel="modulepreload">` preloads, for the given entry point:

::: v-pre
```html
{# templates/index.html #}
{{ vite('resources/js/app.tsx') }}
```
:::

You may also pass several entry points at once:

::: v-pre
```html
{{ vite(['resources/js/app.tsx', 'resources/css/admin.css']) }}
```
:::

### `vite_asset(path)`

For assets that aren't entry points, such as images and fonts, `vite_asset()` returns the public URL:

::: v-pre
```html
<img src="{{ vite_asset('resources/images/logo.png') }}">
```
:::

### `vite_react_refresh()`

If you're using React, `vite_react_refresh()` injects the React Fast Refresh preamble that React HMR needs. It must appear before `vite()`:

::: v-pre
```html
{{ vite_react_refresh() }}
{{ vite('resources/js/app.tsx') }}
```
:::

In production, `vite_react_refresh()` returns an empty string, so you can leave it in your template.

## CSP Nonce

If your application sends a Content Security Policy, you can ask Vite for a nonce:

```python
vite = app.make("vite")
nonce = vite.use_csp_nonce()   # generates a random nonce
# pass nonce to template context, set it in your CSP header
```

Every script and link tag that Vite generates will then include the `nonce` attribute.

## Custom Asset URL Resolver

You can override how asset URLs are built, for example to add a CDN prefix dynamically:

```python
vite = app.make("vite")
vite.create_asset_paths_using(lambda path: f"https://cdn.example.com/{path}")
```

## SRI Integrity

By default, the manifest chunk key `"integrity"` is read and included as the `integrity` attribute on generated tags. You can change the key or turn the feature off:

```python
vite.use_integrity_key("sri")   # use a different key
vite.use_integrity_key(False)   # disable integrity attributes
```
