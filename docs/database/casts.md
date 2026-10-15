---
outline: deep
title: Casts
description: Convert model attributes to and from database values with built-in and custom cast types.
keywords: casts, serialization, model attributes, pydantic, json, orm
---

# Casts

A cast converts a column value when you read it from the database and when you write it back. The type annotation on a model field picks the cast. You can also declare a field explicitly with `Field[T]()`.

## Built-in Casts

| Type annotation | Cast | Example DB value → Python                     |
|---|---|-----------------------------------------------|
| `int` | Integer | `"1"` → `1`                                   |
| `str` | String | `1` → `"1"`                                   |
| `float` | Float | `"3.14"` → `3.14`                             |
| `bool` | Boolean | `1` → `True`, `0` → `False`                   |
| `dict` | JSON | `'{"key":"val"}'` → `{"key": "val"}`          |
| `list` | JSON | `'["a","b"]'` → `["a", "b"]`                  |
| `datetime` | DateTime | `"2024-01-01 08:00:00"` → `datetime.datetime` |
| `date` | DateTime | `"2024-01-01"` → `datetime.date`              |
| `Carbon` | DateTime | `"2024-01-01 00:00:00"` → `Carbon`            |
| `time` | Time | `"09:00:00"` → `datetime.time`                |
| `timedelta` | TimeDelta | `3600.0` → `datetime.timedelta(seconds=3600)` |

Annotate the model fields. No other configuration is needed:

```python
from fastapi_startkit.masoniteorm import Model

class User(Model):
    id: int
    name: str
    is_admin: bool
    score: float
    preferences: dict   # stored as JSON text
    tags: list          # stored as JSON text
```

Values come back as the annotated type:

```python
user = await User.first()

isinstance(user.id, int)          # True
isinstance(user.is_admin, bool)   # True
isinstance(user.preferences, dict) # True
```

When you write, pass Python values. You don't need `json.dumps`:

```python
await User.create({
    "name": "Joe",
    "is_admin": True,
    "preferences": {"theme": "dark", "language": "en"},
    "tags": ["admin", "editor"],
})
```

## Date & Time Casts

### `datetime` and `date`

A field annotated with `datetime` or `date` comes back as a pendulum `DateTime`, which is a `datetime` subclass. Annotate with `Carbon` if you want the field typed as `Carbon` and its helpers.

```python
from datetime import datetime, date
from fastapi_startkit.masoniteorm import Model

class User(Model):
    email_verified_at: datetime   # stored as "YYYY-MM-DD HH:MM:SS"
    date_of_birth: date
```

You can write a string or a native `datetime` / `date`:

```python
import datetime

await User.create({
    "email_verified_at": "2024-06-15 12:30:00",
    "date_of_birth": datetime.date(1990, 6, 1),
})
```

```python
user = await User.first()

user.email_verified_at.year    # 2024
user.date_of_birth.month       # 6
```

### `Carbon`

```python
from fastapi_startkit.carbon import Carbon

class Article(Model):
    published_at: Carbon
```

### `time`

A `time` field is stored as an `"HH:MM:SS"` string and returned as `datetime.time`:

```python
from datetime import time

class User(Model):
    punch_in_time: time
```

```python
user = await User.first()
isinstance(user.punch_in_time, time)   # True
user.punch_in_time.hour                # 9
```

### `timedelta`

A `timedelta` field is stored as a float of total seconds and returned as `datetime.timedelta`:

```python
from datetime import timedelta

class Session(Model):
    duration: timedelta
```

```python
session = await Session.first()
isinstance(session.duration, timedelta)       # True
session.duration.total_seconds()              # 3600.0
```

### Default values

Use `Field(default=...)` or `Field(default_factory=...)` to set the value returned when the column is `NULL`:

```python
from datetime import time
from fastapi_startkit.masoniteorm.models.fields import Field

class User(Model):
    punch_in_time: time = Field(default=time(9, 0, 0))
```

A `NULL` in the database now reads as `time(9, 0, 0)`.

## Nested Pydantic Models

To store a value object in one column, define it as a Pydantic `BaseModel` and use it as the field type. It is serialized to JSON on write and rebuilt as the Pydantic model on read.

### Defining a custom cast

```python
from typing import Optional
from pydantic import BaseModel

class Address(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
```

### Wiring it to a model

```python
from fastapi_startkit.masoniteorm import Model
from app.casts import Address

class User(Model):
    id: int
    name: str
    address: Address
```

The older form `address: Address = ModelField()` still works. `ModelField` is importable from `fastapi_startkit.masoniteorm`, but it emits a `DeprecationWarning` and will be removed in 2.x. Switch to `address: Address`, or to `address = Field[Address]()` if you prefer an explicit field.

Store the value in a `text` or `json` column:

```python
async def up(self):
    async with await self.schema.create("users") as table:
        table.id()
        table.string("name")
        table.text("address").nullable()
        table.timestamps()
```

### Reading

```python
user = await User.where("email", "admin@example.com").first()

isinstance(user.address, Address)   # True
user.address.city                   # "Sydney"
user.address.country                # "Australia"
```

### Inserting

Pass an `Address`, a plain dict, or nothing:

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
