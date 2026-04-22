---
outline: deep
title: Models
---

# Models

Models represent database tables and are the primary interface for reading and writing data. Each model maps to a single table and exposes an async query builder.

## Defining a Model

Extend `Model` from `fastapi_startkit.masoniteorm` and annotate your columns as class-level type hints:

```python
from fastapi_startkit.masoniteorm import Model

class User(Model):
    __table__ = "users"

    id: int
    name: str
    email: str
```

### `__table__`

By default the ORM infers the table name from the class name (pluralized, snake_cased). Set `__table__` explicitly to override:

```python
class PostTag(Model):
    __table__ = "post_tag"
```

### `__timestamps__`

Timestamp columns (`created_at`, `updated_at`) are managed automatically. Set `__timestamps__ = False` to disable them:

```python
class PostTag(Model):
    __table__ = "post_tag"
    __timestamps__ = False
```

## Querying

All query methods are async and must be awaited.

### Fetch all records

```python
users = await User.all()
```

### Fetch the first record

```python
user = await User.first()
```

### Find by primary key

```python
user = await User.find(1)
```

### Filter with `where`

```python
user = await User.where("email", "admin@example.com").first()
```

### `get()` — execute a query

```python
posts = await Post.where("user_id", 1).get()
```

## Creating Records

### `create`

Insert a new record and return the model instance:

```python
post = await Post.create(
    user_id=user.id,
    title="Hello World",
    content="My first post."
)
```

### `first_or_create`

Fetch a matching record or create it if it does not exist. The first dict is the lookup condition, the second is the data to merge on create:

```python
user = await User.first_or_create(
    {"email": "admin@example.com"},
    {"name": "Admin User", "password": "secret"}
)
```

## Updating Records

```python
user = await User.find(1)
user.name = "Jane Doe"
await user.save()
```

## Deleting Records

```python
user = await User.find(1)
await user.delete()
```

## Accessing Attributes

Model attributes map directly to column names:

```python
user = await User.first()
print(user.id)
print(user.name)
print(user.email)
print(user.created_at.diff_for_humans())  # pendulum datetime
```

## Complete Example

The `Post` model from the example app shows columns and relationships together:

```python
# app/models/post.py
from typing import TYPE_CHECKING
from fastapi_startkit.masoniteorm import Model
from fastapi_startkit.masoniteorm.relationships import BelongsTo, HasMany, BelongsToMany

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.tag import Tag
    from app.models.media import Media

class Post(Model):
    __table__ = "posts"

    id: int
    user_id: int
    title: str
    content: str

    author: "User" = BelongsTo('User', local_key='user_id', foreign_key="id")
    media: list["Media"] = HasMany("Media")
    tags: list["Tag"] = BelongsToMany("Tag", "post_id", "tag_id", table="post_tag")
```

Relationship declarations are covered in the [Relationships](./relationships) section.