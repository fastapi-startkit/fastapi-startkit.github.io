---
outline: deep
title: Vite
description: Use Vite to build and serve frontend assets in FastAPI Startkit, with HMR in development and fingerprinted assets in production.
keywords: vite, frontend, assets, fastapi, bundling
---

# Vite

[Vite](https://vitejs.dev) builds your JavaScript, CSS and other frontend assets. `ViteProvider` connects it to your application: while you develop, your pages load assets from the Vite dev server with hot module replacement (HMR), and in production they load the fingerprinted files from the build. Your templates call one helper, `vite()`, in both cases.

## Installing Vite {#setup}

Install the `fastapi` and `vite` extras:

```bash
pip install "fastapi-startkit[fastapi,vite]"
# or
uv add "fastapi-startkit[fastapi,vite]"
```

Then add `ViteProvider` to your application's providers:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit.application import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.vite import ViteProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        FastAPIProvider,
        ViteProvider,
    ],
)
```

Next, publish the starter files:

```bash
uv run python artisan provider:publish --provider=vite
```

This creates the following files:

- `config/vite.py`: the `ViteConfig` dataclass for your application.
- `package.json`: the Vite dependencies and the `dev` and `build` scripts.
- `vite.config.ts`: the Vite config, with the `fastapi-vite-plugin` and Tailwind CSS plugins.
- `tsconfig.json`: the TypeScript config.
- `resources/js/app.ts`: the JavaScript entry point.
- `resources/css/app.css`: the CSS entry point.
- `resources/templates/index.html`: a template that loads the entry point.

Finally, install the frontend dependencies and start the dev server:

```bash
npm install
npm run dev
```

The [vite-app](https://github.com/fastapi-startkit/fastapi-startkit-framework/tree/main/example/vite-app) example in the framework repository shows the complete setup.

## Configuring Vite {#configuration}

The published `config/vite.py` defines a `ViteConfig` dataclass. To use it, register the provider as a tuple with your config class:

```python
# bootstrap/application.py
from config.vite import ViteConfig

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        FastAPIProvider,
        (ViteProvider, ViteConfig),
    ],
)
```

When you register `ViteProvider` on its own, it uses the defaults below. You may also pass an instance to change a single value, for example `(ViteProvider, ViteConfig(asset_url="https://cdn.example.com"))`.

| Option | Default | Description |
|---|---|---|
| `public_path` | `"public"` | Directory that holds the hot file and the build directory. |
| `build_directory` | `"build"` | Directory inside `public_path` that `npm run build` writes to. |
| `hot_file` | `"hot"` | File inside `public_path` whose presence means the dev server is running. |
| `manifest_filename` | `"manifest.json"` | Name of the Vite manifest inside the build directory. |
| `asset_url` | `""` | Prefix for built asset URLs, such as a CDN origin. |
| `static_url` | `"/build"` | URL path where the build directory is served. |
| `mount_static` | `True` | Serve the build directory at `static_url` when it exists. |
| `template` | `True` | Bind a `Jinja2Templates` instance for `templates_directory` to the container as `templates`, unless a `templates` binding already exists. |
| `templates_directory` | `"resources/templates"` | Template directory, relative to your application's `base_path`. |

`public_path` is resolved from the current working directory, not from `base_path`, so start your server from the project root.

## Loading Assets in a Template {#loading-a-page-with-js-and-css}

`ViteProvider` binds Jinja2 templates to the container as `templates`. To render a page, resolve it and return a `TemplateResponse`:

```python
# app/http/controllers/home_controller.py
from fastapi import Request

from fastapi_startkit.application import app


async def index(request: Request):
    templates = app().make("templates")
    return templates.TemplateResponse(request, "index.html", {"title": "Home"})
```

In the template, call `vite()` with your entry point. It outputs the `<script>` and `<link>` tags for that entry and the CSS and chunks it imports:

```html
<!-- resources/templates/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ title }}</title>
    {{ vite('resources/js/app.ts') }}
</head>
<body>
    <h1>{{ title }}</h1>
</body>
</html>
```

## Running the Dev Server {#development-mode-hmr}

While you develop, run the Vite dev server next to your application:

```bash
npm run dev
```

The dev server writes its URL, such as `http://localhost:5173`, to `public/hot`, and removes the file when it stops. While the file exists, `vite()` loads `@vite/client` and your entry points from that URL, so changes appear in the browser without a reload. If the file is empty, the framework uses `http://localhost:5173`.

## Building for Production {#production-mode}

Before you deploy, build your assets:

```bash
npm run build
```

Vite writes the fingerprinted files and `public/build/manifest.json`. When there's no hot file, `vite()` reads the manifest and outputs tags for the built files, with preload tags for their CSS and imported chunks:

```html
<link rel="preload" as="style" href="/build/assets/app-5a1c2b3d.css" /><link rel="modulepreload" href="/build/assets/app-4ed993c7.js" /><link rel="stylesheet" href="/build/assets/app-5a1c2b3d.css" /><script type="module" src="/build/assets/app-4ed993c7.js"></script>
```

The provider serves `public/build` at `/build`. The manifest is read once and kept in memory, so restart the server after each build.

If the manifest is missing, `vite()` raises `ViteManifestNotFoundException`. If an entry point isn't in the manifest, it raises `ViteException`. Both are exported from `fastapi_startkit.vite`.

## Template Helpers

`ViteProvider` adds three functions to every Jinja2 template.

### `vite(entrypoint)`

`vite()` outputs the tags for one entry point:

```html
{{ vite('resources/js/app.ts') }}
```

You may also pass a list of entry points:

```html
{{ vite(['resources/js/app.ts', 'resources/css/admin.css']) }}
```

### `vite_asset(path)`

`vite_asset()` returns the URL of a single file, such as an image or a font. The file must be in the Vite manifest:

```html
<img src="{{ vite_asset('resources/images/logo.png') }}" alt="Logo">
<!-- /build/assets/logo-0c1d2e.png -->
```

While the dev server runs, the URL points at the dev server instead.

### `vite_react_refresh()`

When you use React, call `vite_react_refresh()` before `vite()`. It outputs the React Fast Refresh preamble that React HMR needs:

```html
{{ vite_react_refresh() }}
{{ vite('resources/js/app.tsx') }}
```

It outputs nothing in production, so you can leave it in your template.

## Adding a CSP Nonce {#csp-nonce}

When your application sends a Content Security Policy, give the tags Vite outputs a nonce. Call `use_csp_nonce()` in your route before you render the template, and send the same nonce in the header:

```python
# app/http/controllers/home_controller.py
from fastapi import Request

from fastapi_startkit.application import app


async def index(request: Request):
    nonce = app().make("vite").use_csp_nonce()
    response = app().make("templates").TemplateResponse(request, "index.html", {"title": "Home"})
    response.headers["Content-Security-Policy"] = f"script-src 'nonce-{nonce}'; style-src 'self' 'nonce-{nonce}'"
    return response
```

Every tag that `vite()` outputs for this response now has a `nonce` attribute. Inside a request, the nonce applies to that request only. You may pass your own value, as in `use_csp_nonce("abc123")`.

## Serving Assets From a CDN {#custom-asset-url-resolver}

To load built assets from a CDN, set `asset_url` in your config. URLs become `https://cdn.example.com/build/assets/app-4ed993c7.js`:

```python
# config/vite.py
from dataclasses import dataclass

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env


@dataclass
class ViteConfig(Config):
    public_path: str = "public"
    build_directory: str = "build"
    hot_file: str = "hot"
    manifest_filename: str = "manifest.json"
    asset_url: str = env("ASSET_URL", "")
    static_url: str = "/build"
    mount_static: bool = True
    template: bool = True
    templates_directory: str = "resources/templates"
```

To build the URLs yourself, pass a function to `create_asset_paths_using()` in a provider's `boot()` method. It receives the path relative to `public_path`, such as `build/assets/logo-0c1d2e.png`:

```python
# app/providers/app_provider.py
from fastapi_startkit.support import Provider


class AppProvider(Provider):
    def boot(self):
        vite = self.app.make("vite")
        vite.create_asset_paths_using(lambda path: f"https://cdn.example.com/{path}")
```

Pass `None` to go back to the default URLs.

## Adding Tag Attributes

You can add attributes to the tags `vite()` outputs, in a provider's `boot()` method. Each method takes a dict, or a function that receives the source path, the URL, the manifest chunk and the manifest, and returns a dict:

```python
# app/providers/app_provider.py
from fastapi_startkit.support import Provider


class AppProvider(Provider):
    def boot(self):
        vite = self.app.make("vite")
        vite.use_script_tag_attributes(lambda src, url, chunk, manifest: {"data-entry": src})
        vite.use_style_tag_attributes({"data-turbo-track": "reload"})
        vite.use_preload_tag_attributes({"data-preload": True})
```

The script tag then reads:

```html
<script type="module" src="/build/assets/app-4ed993c7.js" data-entry="resources/js/app.ts"></script>
```

An attribute set to `True` is output without a value. To leave out the preload tags, call `use_preload_tag_attributes(False)`.

## Subresource Integrity {#sri-integrity}

When a manifest chunk has an `integrity` key, `vite()` adds it to the tag as the `integrity` attribute. To read a different key, or to turn this off, call `use_integrity_key()` in a provider's `boot()` method:

```python
# app/providers/app_provider.py
from fastapi_startkit.support import Provider


class AppProvider(Provider):
    def boot(self):
        vite = self.app.make("vite")
        vite.use_integrity_key("sri")  # or False to turn it off
```

Related pages: [Inertia](/docs/frontend/inertia) builds on this setup.
