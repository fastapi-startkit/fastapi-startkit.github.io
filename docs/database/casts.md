---
outline: deep
title: Casts
description: Automatically serialize and deserialize model attributes using built-in and custom cast types.
keywords: casts, serialization, model attributes, pydantic, json, orm
---

# Casts

Casts automatically transform model attribute values when reading from or writing to the database. Annotate a field with the desired type and the ORM handles the conversion transparently.

## Built-in Casts

| Type annotation | Cast | Example DB value → Python |
|---|---|---|
| `int` | Integer | `"1"` → `1` |
| `str` | String | `1` → `"1"` |
| `float` | Float | `"3.14"` → `3.14` |
| `bool` | Boolean | `1` → `True`, `0` → `False` |
| `dict` | JSON | `'{"key":"val"}'` → `{"key": "val"}` |
| `list` | JSON | `'["a","b"]'` → `["a", "b"]` |
| `Carbon` | DateTime | `"2024-01-01 00:00:00"` → `Carbon` |

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