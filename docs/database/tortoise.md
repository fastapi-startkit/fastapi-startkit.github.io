---
outline: deep
title: Tortoise ORM
description: Integrate Tortoise ORM with FastAPI Startkit through a service provider, with Tortoise.init and close_connections in the app lifespan, models, async CRUD, and aerich migrations.
keywords: tortoise orm, aerich, async orm, models, migrations, service provider, fastapi startkit
---

# Tortoise ORM

[Tortoise ORM](https://tortoise.github.io) is an async-first ORM for Python with a Django-style API. It works with SQLite, PostgreSQL, and MySQL, and it pairs with [Aerich](https://github.com/tortoise/aerich) for schema migrations. FastAPI Startkit ships its own [Masonite-based ORM](/docs/database/models), but if you prefer Tortoise you can wire it in through a service provider, as this guide shows. The provider opens the connection when FastAPI starts and closes it when FastAPI shuts down, so your endpoints never manage the connection themselves.

## Installation

Install Tortoise ORM and Aerich, plus the driver for your database. This guide uses SQLite through `aiosqlite`:

```bash
uv add tortoise-orm aerich aiosqlite
# PostgreSQL: uv add asyncpg
# MySQL:      uv add aiomysql
```

## Project Layout

The provider, the configuration, and the models live in your application:

```
config/
    tortoise.py
providers/
    tortoise_provider.py
app/
    models.py
routes/
    web.py
migrations/          # created by aerich
```

## Configuration

Define the connection and the modules that hold your models. Aerich reads the same `TORTOISE_ORM` dictionary, so keep it in a module that both the provider and Aerich can import:

```python
# config/tortoise.py
import os
from dataclasses import dataclass, field

from fastapi_startkit.configuration import Config

TORTOISE_ORM = {
    "connections": {
        "default": os.getenv("DATABASE_URL", "sqlite://storage/db.sqlite3"),
    },
    "apps": {
        "models": {
            "models": ["app.models", "aerich.models"],
            "default_connection": "default",
        },
    },
}


@dataclass
class TortoiseConfig(Config):
    db_url: str = os.getenv("DATABASE_URL", "sqlite://storage/db.sqlite3")
    modules: list[str] = field(default_factory=lambda: ["app.models"])
```

`db_url` is the URL Tortoise connects to. Use `postgres://user:password@host:5432/app`, `mysql://user:password@host:3306/app`, or `sqlite://storage/db.sqlite3` depending on your database. `modules` lists the Python modules Tortoise scans for models. The `aerich.models` entry is only needed by Aerich, so it's left out of the provider's list.

## Creating the Service Provider

The provider follows the same two-phase pattern as the other service providers. `register()` merges the config under the `tortoise` key, and `boot()` wraps the FastAPI lifespan so Tortoise starts up and shuts down with the app:

```python
# providers/tortoise_provider.py
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi_startkit.support import Provider
from tortoise import Tortoise

from config.tortoise import TortoiseConfig


class TortoiseProvider(Provider):
    provider_key = "tortoise"

    def register(self) -> None:
        self.settings = self.resolve_config(TortoiseConfig)
        self.merge_config_from(self.settings, self.provider_key)

    def boot(self) -> None:
        try:
            router = self.app.fastapi.router
        except RuntimeError:
            return

        settings = self.settings
        lifespan = router.lifespan_context

        @asynccontextmanager
        async def tortoise_lifespan(app: Any) -> AsyncIterator[Any]:
            await Tortoise.init(db_url=settings["db_url"], modules={"models": settings["modules"]})
            try:
                async with lifespan(app) as state:
                    yield state
            finally:
                await Tortoise.close_connections()

        router.lifespan_context = tortoise_lifespan
```

Then register the provider in `bootstrap/application.py`, passing your config class the same way the other providers accept theirs:

```python
from fastapi_startkit import Application

from config.tortoise import TortoiseConfig
from providers.tortoise_provider import TortoiseProvider

app = Application(
    base_path=...,
    providers=[
        (TortoiseProvider, TortoiseConfig),
        # ... other providers
    ],
)
```

`Tortoise.init` runs during FastAPI startup, before the first request is served. `Tortoise.close_connections` runs at shutdown, even when your own lifespan raises, because it sits in a `finally` block.

::: warning Wrap the router before it is replaced
The provider wraps the router that exists when it boots. If you replace the FastAPI instance or its `lifespan=` later, open and close Tortoise in your own lifespan instead, using the same `Tortoise.init` and `Tortoise.close_connections` calls.
:::

## Defining Models

Models are ordinary Tortoise classes. Put them in the modules listed in `TortoiseConfig.modules`:

```python
# app/models.py
from tortoise import fields
from tortoise.models import Model


class Event(Model):
    id = fields.IntField(primary_key=True)
    name = fields.TextField()

    class Meta:
        table = "event"

    def __str__(self) -> str:
        return self.name
```

Tortoise models use `fields` for columns, such as `IntField`, `TextField`, `CharField`, `DatetimeField`, and `ForeignKeyField`. Relationships are declared on the model with the same `fields` module, so you don't need to add anything to the provider when you add a model.

## Migrations with Aerich

Tortoise can create tables for you with `Tortoise.generate_schemas()`, which is handy while you prototype. For anything you'll deploy, use Aerich so every schema change is recorded as a migration file.

Point Aerich at the `TORTOISE_ORM` dictionary once:

```bash
uv run aerich init -t config.tortoise.TORTOISE_ORM
uv run aerich init-db
```

`aerich init` writes a `[tool.aerich]` section to `pyproject.toml`, and `init-db` creates the migrations folder and the first migration for the tables that already exist in your models. After you change a model, generate and apply the next migration:

```bash
uv run aerich migrate --name add_event_name
uv run aerich upgrade
```

Roll back the last migration with `uv run aerich downgrade`, and list the applied migrations with `uv run aerich history`.

## Using the ORM

With the provider booted, you can query your models from any endpoint. Every Tortoise query is awaitable:

```python
# routes/web.py
from fastapi import HTTPException
from fastapi_startkit.fastapi import Router
from pydantic import BaseModel
from tortoise.contrib.pydantic import pydantic_model_creator

from app.models import Event

EventOut = pydantic_model_creator(Event, name="EventOut")


class EventIn(BaseModel):
    name: str


async def index():
    return await EventOut.from_queryset(Event.all())


async def store(payload: EventIn):
    event = await Event.create(name=payload.name)
    return await EventOut.from_tortoise_orm(event)


async def show(event_id: int):
    event = await Event.get_or_none(id=event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return await EventOut.from_tortoise_orm(event)


async def update(event_id: int, payload: EventIn):
    await Event.filter(id=event_id).update(name=payload.name)
    return await EventOut.from_queryset_single(Event.get(id=event_id))


async def destroy(event_id: int):
    await Event.filter(id=event_id).delete()


router = Router()
router.get("/events", index)
router.post("/events", store, status_code=201)
router.get("/events/{event_id}", show)
router.patch("/events/{event_id}", update)
router.delete("/events/{event_id}", destroy, status_code=204)
```

`pydantic_model_creator` builds the response schema from the model, so responses contain only the fields you declare, and the Tortoise model itself never leaks into the API.

The common operations map to these calls:

| Operation | Tortoise call |
|---|---|
| Create | `await Event.create(name="Test")` |
| Read all | `await Event.all()` |
| Read one | `await Event.get(id=1)` or `await Event.get_or_none(id=1)` |
| Filter | `await Event.filter(name="Test")` |
| Update | `await Event.filter(id=1).update(name="Updated")` |
| Delete | `await Event.filter(id=1).delete()` |

## Running Outside FastAPI

Console commands and scripts don't run the FastAPI lifespan, so initialise Tortoise yourself and close it when you're done:

```python
import asyncio

from tortoise import Tortoise

from app.models import Event
from config.tortoise import TortoiseConfig


async def main() -> None:
    config = TortoiseConfig()
    await Tortoise.init(db_url=config.db_url, modules={"models": config.modules})
    try:
        event = await Event.create(name="Test")
        await Event.filter(id=event.id).update(name="Updated")
        print(await Event.filter(name="Updated").count())
        await Event.filter(id=event.id).delete()
    finally:
        await Tortoise.close_connections()


asyncio.run(main())
```

This mirrors the [Tortoise basic example](https://tortoise.github.io/examples/basic.html): `Tortoise.init` with a `db_url` and `modules`, create and query records, and `Tortoise.close_connections()` at the end.
