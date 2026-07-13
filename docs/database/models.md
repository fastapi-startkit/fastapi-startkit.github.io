---
outline: deep
title: Models
description: Define your database models using the powerful Masonite ORM integrated into Fastapi Startkit.
keywords: orm, models, database, fastapi, active record
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

### `find_or_fail(id)` — find or raise

Fetch a record by primary key, raising `ModelNotFoundException` if nothing is found:

```python
user = await User.find_or_fail(1)
```

### `first_or_fail()` — first or raise

Execute the current query and raise `ModelNotFoundException` if no record matches:

```python
user = await User.where("email", "admin@example.com").first_or_fail()
```

### `exists()` — check existence

Return `True` if any record matches the current query, `False` otherwise:

```python
active = await User.where("is_active", True).exists()
```

### `count()` — row count

Return the number of rows matching the current query:

```python
total = await User.count()
active_count = await User.where("is_active", True).count()
```

### `paginate(per_page, page)` — paginate results

Return a `LengthAwarePaginator` containing the requested slice of records plus total-count metadata:

```python
page = await User.paginate(per_page=15, page=1)
# page.items      → list of User instances
# page.total      → total number of matching rows
# page.last_page  → last available page number
```

### `or_where` / `where_raw` / `or_where_raw` / `or_where_null` — raw & OR variants

```python
# OR condition
users = await User.where("role", "admin").or_where("role", "moderator").get()

# Raw SQL predicate
users = await User.where_raw("created_at > NOW() - INTERVAL '7 days'").get()

# Raw SQL with OR
users = await User.where("is_active", True).or_where_raw("role = 'superadmin'").get()

# OR IS NULL
users = await User.where("name", "Alice").or_where_null("deleted_at").get()
```

### Retrieving records

Call `get()` to run the current query and retrieve all matching rows as a `Collection` of model instances:

```python
users = await User.where("is_active", True).get()

for user in users:
    print(user.email)
```

#### Chunking large result sets

When you need to process a large number of records, loading them all at once with `all()` or `get()` can exhaust memory. The `chunk` methods retrieve a small batch of records at a time. They return async iterators, so consume them with `async for`:

```python
async for users in User.chunk(200):
    for user in users:
        print(user.email)
```

You can chunk a constrained query too:

```python
async for projects in Project.where("is_active", True).chunk(100):
    for project in projects:
        await project.archive()
```

`chunk(size)` pages with `limit`/`offset` and stops as soon as a batch comes back empty or shorter than `size`.

#### `chunk_by_id(size, column=None, alias=None)`

Pages using a keyset cursor instead of `offset` — it orders by an incrementing column (the primary key by default) and filters each batch with `column > last_id`. This stays correct even when rows are added or removed mid-iteration:

```python
async for users in User.chunk_by_id(500):
    for user in users:
        await user.recalculate_score()
```

A pre-set `offset` applies to the **first page only**; a pre-set `limit` caps the **total** rows across batches (limit-remaining) — e.g. `.limit(250)` chunked by 100 yields batches of `100 + 100 + 50`. Pass `column` to page by a different column, and `alias` when that column is selected under a different name.

> `chunk_by_id` ignores any `order_by` on the query and raises a `RuntimeError` if the `alias` column is missing from a row.

#### `chunk_by_id_desc(size, column=None, alias=None)`

The descending counterpart of `chunk_by_id` — walks from the highest id to the lowest, filtering each batch with `column < last_id`:

```python
async for projects in Project.chunk_by_id_desc(100):
    for project in projects:
        await project.archive()
```

> All three chunk methods raise a `ValueError` if the batch size is not a positive integer.

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

### `insert` — bulk insert rows

Insert one or many rows without instantiating individual model instances:

```python
await User.insert({"email": "picard@example.com", "votes": 0})

await User.insert([
    {"email": "picard@example.com", "votes": 0},
    {"email": "janeway@example.com", "votes": 0},
])
```

> Unlike `create`, `insert` does not fire model events, apply timestamps, or return model instances. It is intended for high-volume seed and batch operations.

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

Automatic type coercion and custom value objects are covered in the [Casts](./casts) section.