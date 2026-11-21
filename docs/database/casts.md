---
outline: deep
title: Casts
description: Convert model attributes to and from database values with built-in and custom cast types.
keywords: casts, serialization, model attributes, pydantic, json, orm
---

# Casts

## Introduction

Casts convert a model attribute when you read it from the database and again when you write it back, so you work with booleans, dicts, and dates instead of `1`, JSON strings, and text. The type annotation on a model field picks the cast, so most of the time the annotation is all you write.

- [Using Built-in Casts](#using-built-in-casts)
- [Casting Dates and Times](#casting-dates-and-times)
- [Handling Null Values](#handling-null-values)
- [Storing Pydantic Models](#storing-pydantic-models)
- [Writing Custom Casts](#writing-custom-casts)

## Using Built-in Casts

Annotate the model's fields with Python types:

```python
# app/models/user.py
from fastapi_startkit.masoniteorm import Model


class User(Model):
    name: str
    is_admin: bool
    score: float
    preferences: dict
    tags: list[str]
```

When you read a model, each value comes back as the annotated type:

```python
user = await User.first()

user.is_admin     # True, stored as 1
user.preferences  # {"theme": "dark"}, stored as JSON text
```

Writing works the other way round. Pass plain Python values, without `json.dumps`:

```python
await User.create({
    "name": "Joe",
    "is_admin": True,
    "score": 3.14,
    "preferences": {"theme": "dark", "language": "en"},
    "tags": ["admin", "editor"],
})
```

The annotation decides the cast:

| Annotation | Read as | Stored as |
|---|---|---|
| `int` | `int` | integer |
| `str` | `str` | text |
| `float` | `float` | float |
| `bool` | `bool` | boolean |
| `dict`, `list`, `dict[...]`, `list[...]` | `dict` or `list` | JSON text |
| `datetime`, `date`, `Carbon` | `Carbon` | UTC datetime |
| `time` | `datetime.time` | `"HH:MM:SS"` text |
| `timedelta` | `datetime.timedelta` | total seconds |
| An `Enum` subclass | the enum member | the value you write |
| A Pydantic model | the Pydantic model | JSON text |

Other annotations, such as `Decimal`, are read as `str` and written as you pass them.

An enum field is read back as a member, but it's written as you pass it. Use a `StrEnum` or `IntEnum`, or pass the member's `.value`:

```python
from enum import StrEnum


class Status(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


class Post(Model):
    title: str
    status: Status
```

## Casting Dates and Times

A field annotated with `datetime`, `date`, or `Carbon` comes back as a `Carbon` instance. `Carbon` is pendulum's `DateTime`, which is a `datetime` subclass, so a `date` field also comes back as a datetime at midnight:

```python
from datetime import date, datetime

from fastapi_startkit.carbon import Carbon
from fastapi_startkit.masoniteorm import Model


class User(Model):
    email_verified_at: datetime
    date_of_birth: date
    last_seen_at: Carbon
```

When writing, pass a string, a `datetime`, or a `date`. The value is stored in UTC:

```python
await User.create({
    "email_verified_at": "2024-06-15 12:30:00",
    "date_of_birth": date(1990, 6, 1),
})

user = await User.first()
user.email_verified_at.year  # 2024
user.date_of_birth.month     # 6
```

A value that can't be parsed as a datetime raises `ValueError`.

### Times and Durations

A `time` field is stored as an `"HH:MM:SS"` string and read as `datetime.time`. A `timedelta` field is stored as a number of seconds and read as `datetime.timedelta`:

```python
from datetime import time, timedelta


class Shift(Model):
    starts_at: time
    length: timedelta
```

```python
shift = await Shift.first()

shift.starts_at.hour            # 9
shift.length.total_seconds()    # 3600.0
```

## Handling Null Values

To allow `NULL`, add `| None` to the annotation. The attribute then reads as `None`:

```python
class User(Model):
    nickname: str | None
    login_count: int | None
    is_banned: bool | None
```

Without `| None`, a `NULL` goes through the cast: an `int` or `float` field raises `TypeError`, and a `bool` field reads as `False`.

To read a `NULL` as a default value instead, use `Field(default=...)` or `Field(default_factory=...)`:

```python
from datetime import time

from fastapi_startkit.masoniteorm import Field, Model


class User(Model):
    punch_in_time: time = Field(default=time(9, 0, 0))
```

A `NULL` in `punch_in_time` now reads as `time(9, 0, 0)`.

## Storing Pydantic Models

To store a group of values in one column, such as the parts of an address, define a Pydantic model and use it as the field type. It's written as JSON and read back as the Pydantic model:

```python
# app/models/user.py
from pydantic import BaseModel

from fastapi_startkit.masoniteorm import Model


class Address(BaseModel):
    street: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None


class User(Model):
    name: str
    address: Address | None
```

Store the value in a `text` or `json` column:

```python
async with await self.schema.create("users") as table:
    table.id()
    table.string("name")
    table.text("address").nullable()
    table.timestamps()
```

When you create a record, pass an `Address`, a dict, or nothing:

```python
await User.create({
    "name": "Joe",
    "address": Address(street="123 Main St", city="Sydney", state="NSW", country="Australia"),
})

await User.create({
    "name": "Jane",
    "address": {"street": "456 Queen St", "city": "Melbourne", "state": "VIC", "country": "Australia"},
})

await User.create({"name": "Guest"})
```

```python
user = await User.where("name", "Joe").first()

user.address.city  # "Sydney"
```

You can also declare the field explicitly with `address = Field[Address]()`. The older `address: Address = ModelField()` form still works, but it emits a `DeprecationWarning` and will be removed in 2.x. Replace it with `address: Address` or `Field[Address]()`.

## Writing Custom Casts

When no built-in cast fits, write your own. Extend `BaseCast` and implement `get`, which converts the database value for your code, and `set`, which converts your value for the database. Then attach it to the field with `Annotated`:

```python
# app/models/order.py
from typing import Annotated

from fastapi_startkit.masoniteorm import Model
from fastapi_startkit.masoniteorm.models.caster import BaseCast


class Cents(BaseCast):
    def get(self, value):
        return value / 100

    def set(self, value):
        return round(value * 100)


class Order(Model):
    total: Annotated[float, Cents]
```

`order.total` reads `1250` from the database as `12.5`, and writing `12.5` stores `1250`. You can pass the class or an instance, such as `Annotated[float, Cents()]`. A cast declared this way replaces the cast the type would otherwise get, including for `created_at` and `updated_at`.
