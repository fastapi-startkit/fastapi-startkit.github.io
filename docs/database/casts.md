---
outline: deep
title: Casts
description: Automatically serialize and deserialize model attributes using built-in and custom cast types.
keywords: casts, serialization, model attributes, pydantic, json, orm
---

# Casts

Casts automatically transform model attribute values when reading from or writing to the database. Annotate a field with the desired type and the ORM handles the conversion transparently.

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
| `date` | DateTime | `"2024-01-01"` → `datetiem.date`              |
| `Carbon` | DateTime | `"2024-01-01 00:00:00"` → `Carbon`            |
| `time` | Time | `"09:00:00"` → `datetime.time`                |
| `timedelta` | TimeDelta | `3600.0` → `datetime.timedelta(seconds=3600)` |

Define the type annotation on the model — no extra configuration required:

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

When reading a record, the ORM applies each cast automatically:

```python
user = await User.first()

isinstance(user.id, int)          # True
isinstance(user.is_admin, bool)   # True
isinstance(user.preferences, dict) # True
```

When inserting, native Python values are serialized automatically — no manual `json.dumps` needed:

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

Fields annotated with `datetime` are returned as a `datetime` object on read, and fields annotated with `date` are returned as a `date` object. Use `Carbon` as the annotation if you want the richer `Carbon` type with timezone-aware helpers.

```python
from datetime import datetime, date
from fastapi_startkit.masoniteorm import Model

class User(Model):
    email_verified_at: datetime   # stored as "YYYY-MM-DD HH:MM:SS", returned as datetime
    date_of_birth: date           # stored as "YYYY-MM-DD", returned as datetime
```

When inserting you can pass a string or a native `datetime` / `date` object:

```python
import datetime

await User.create({
    "email_verified_at": "2024-06-15 12:30:00",                     # string
    "date_of_birth": datetime.datetime.now(datetime.timezone.utc),  # native datetime
})
```

```python
user = await User.first()

user.email_verified_at.year    # 2024
user.date_of_birth.month       # 6
```

### `Carbon`

Annotate with `Carbon` when you want the timezone-aware `Carbon` type:

```python
from fastapi_startkit.carbon import Carbon

class Article(Model):
    published_at: Carbon
```

### `time`

`time` annotations use `TimeCast`. The value is stored as an `"HH:MM:SS"` string and returned as `datetime.time`.

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

`timedelta` annotations use `TimeDeltaCast`. The value is stored as a float (total seconds) and returned as `datetime.timedelta`.

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

Use `Field(default=...)` or `Field(default_factory=...)` to specify a fallback when the column is `NULL`:

```python
from datetime import time
from fastapi_startkit.masoniteorm.models.fields import Field

class User(Model):
    punch_in_time: time = Field(default=time(9, 0, 0))
```

A `NULL` database value will be returned as `time(9, 0, 0)` instead of `None`.

## Custom Casts with `Attribute`

For complex types — such as embedded value objects — extend `Attribute`. It is a Pydantic `BaseModel` subclass, so fields are validated and the instance is serialized to JSON automatically.

### Defining a custom cast

```python
from typing import Optional
from fastapi_startkit.masoniteorm import Attribute

class Address(Attribute):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
```

### Wiring it to a model

Annotate the field with your `Attribute` subclass:

```python
from fastapi_startkit.masoniteorm import Model
from app.casts import Address

class User(Model):
    id: int
    name: str
    address: Address
```

The column should be a `text` or `json` column in your migration:

```python
async def up(self):
    async with await self.schema.create("users") as table:
        table.id()
        table.string("name")
        table.text("address").nullable()
        table.timestamps()
```

### Reading

The JSON text stored in the column is deserialized into an `Address` instance on access:

```python
user = await User.where("email", "admin@example.com").first()

isinstance(user.address, Address)   # True
user.address.city                   # "Sydney"
user.address.country                # "Australia"
```

### Inserting

You can pass an `Address` instance, a plain dict, or `None` — the cast handles serialization:

```python
# Address instance
await User.create({
    "name": "Joe",
    "address": Address(street="123 Main St", city="Sydney", state="NSW", country="Australia"),
})

# Plain dict
await User.create({
    "name": "Jane",
    "address": {"street": "456 Queen St", "city": "Melbourne", "state": "VIC", "country": "Australia"},
})

# No address
await User.create({"name": "Guest"})
```
