---
outline: deep
title: Why fastapi-startkit
description: Why fastapi-startkit exists — the application-level concerns FastAPI leaves to you, and how a provider-driven, batteries-included framework fills the gap without replacing FastAPI.
keywords: fastapi, fastapi framework, fastapi boilerplate, python application framework, service providers, why fastapi-startkit
jsonLd:
  "@type": "TechArticle"
  "headline": "Why fastapi-startkit"
  "description": "The positioning behind fastapi-startkit — what FastAPI leaves to you, the provider model, and why it complements rather than replaces FastAPI."
  "articleSection": "Guide"
  "author":
    "@type": "Organization"
    "name": "Fastapi Startkit Team"
---

# Why fastapi-startkit

FastAPI is one of the best ways to build an API in Python. It is fast, typed, and a joy to work with. But FastAPI is a **web framework**, not an **application framework** — and that distinction is the reason this project exists.

## What FastAPI leaves to you

FastAPI deliberately stays focused on the HTTP layer: routing, validation, serialization, dependency injection for requests. Everything else — the scaffolding a real application needs — it leaves to you to design and wire together:

- **Configuration** — loading `.env` files, layering per-environment overrides, and exposing typed settings across the app.
- **Database & ORM** — choosing a driver, managing async sessions, migrations, and seeders.
- **Logging** — channels, formatters, and dynamic configuration you can tune per environment.
- **CLI / console commands** — a place to hang `serve`, `migrate`, `make:model`, and your own tasks.
- **Storage, queues, and background workers** — filesystem abstractions and task processing.
- **Bootstrapping** — a consistent way to compose all of the above and boot it in the right order.

None of this is hard on its own. The problem is that you rebuild it for every project, and the copies drift apart over time. fastapi-startkit packages these concerns into one coherent, **batteries-included** foundation so you can start with the infrastructure already in place.

## The provider model

Applications are composed by **registering providers**. Each provider knows how to register its services into the container (`register()`) and run any startup logic once everything is registered (`boot()`). You pick the capabilities you want and hand them to the `Application`.

A provider can be listed as a **bare class**, or paired with a config object as a **`(Provider, Config)` tuple** when it needs configuration. Here is a real bootstrap from the [`fastapi-app` example](https://github.com/fastapi-startkit/fastapi-startkit/blob/main/example/fastapi-app/bootstrap/application.py):

```python
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.logging import LogProvider
from providers.fastapi_provider import FastAPIProvider
from config.fastapi import FastAPIConfig

app: Application = Application(
    base_path=str(Path.cwd()),  # This always gives path relative to the execution.
    providers=[
        LogProvider,
        (FastAPIProvider, FastAPIConfig),
    ]
)
```

`LogProvider` is registered as a bare class — it needs no configuration. `FastAPIProvider` is paired with `FastAPIConfig` as a tuple because it does. Adding a capability — a database, a queue, storage — is as simple as adding another entry to the list. Removing one is deleting a line. The composition of your application is explicit and lives in a single place.

## FastAPI is optional — go headless when you need to

Although the name says FastAPI, the HTTP layer is **entirely optional**. The container, providers, configuration, logging, ORM, and console commands do not depend on FastAPI being present.

That means you can build:

- **Headless CLI utilities** and Artisan-style commands.
- **Cron scripts** and scheduled jobs.
- **Background workers** and queue consumers.

…and still get the full suite of infrastructure components. Register `FastAPIProvider` when you want to serve HTTP; leave it out when you don't. The FastAPI, database, and Vite integrations are all installed as [optional extras](/docs/getting-started#installation), so you only pull in what you use.

## Not a replacement for FastAPI

fastapi-startkit is **not** a competitor to FastAPI, and it does not hide it. When you serve HTTP, you are running a real FastAPI app — the same routing, the same `Depends`, the same OpenAPI docs, the same Starlette underneath. Your `app.fastapi` instance is a plain FastAPI application you can reach for at any time.

Think of it as the layer **around** FastAPI: it brings the proven structure of mature web frameworks to Python while staying modular, so you can adopt as much or as little as you need. You never trade away FastAPI to use it.

## Next steps

Ready to build? Head to [Getting Started](/docs/getting-started) to install the framework and stand up your first application.
