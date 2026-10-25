---
outline: deep
title: Models
description: Define database models with the Masonite ORM built into FastAPI Startkit.
keywords: orm, models, database, fastapi, active record
---

# Models

Models are the heart of the ORM. Each model maps to one database table, and it's the class you reach for whenever you want to query, insert, update, or delete rows in that table. Each instance represents a single row, and you work with its columns as ordinary Python attributes.

## Defining a Model

To get started, extend `Model` from `fastapi_startkit.masoniteorm` and annotate the columns with Python types:

```python
from fastapi_startkit.masoniteorm import Model

class User(Model):
    __table__ = "users"

    id: int
    name: str
    email: str
```

### `__table__`

By default, the table name is the class name, snake_cased and pluralized. If your table is named something else, set `__table__`:

```python
class PostTag(Model):
    __table__ = "post_tag"
```

### `__timestamps__`

The model fills in `created_at` and `updated_at` for you when it saves. If a table doesn't have those columns, set `__timestamps__ = False`:

```python
class PostTag(Model):
    __table__ = "post_tag"
    __timestamps__ = False
```

## Querying

Every method that hits the database is async, so remember to `await` it. Here are the queries you'll use most often.

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

`find_or_fail` raises `ModelNotFoundException` when no row has that primary key:

```python
user = await User.find_or_fail(1)
```

### `first_or_fail()` — first or raise

`first_or_fail` raises `ModelNotFoundException` when the query matches nothing:

```python
user = await User.where("email", "admin@example.com").first_or_fail()
```

### `exists()` — check existence

```python
active = await User.where("is_active", True).exists()
```

### `count()` — row count

```python
total = await User.count()
active_count = await User.where("is_active", True).count()
```

### `paginate(per_page, page)` — paginate results

`paginate` is a query builder method, so you start from `query()` or a `where`. It returns a `LengthAwarePaginator`:

```python
page = await User.query().paginate(per_page=15, page=1)

page.result     # the User instances on this page
page.total      # total number of matching rows
page.last_page  # last page number
```

### `or_where` / `where_raw` / `or_where_raw` / `or_where_null` — raw & OR variants

```python
users = await User.where("role", "admin").or_where("role", "moderator").get()

users = await User.where_raw("created_at > NOW() - INTERVAL '7 days'").get()

users = await User.where("is_active", True).or_where_raw("role = 'superadmin'").get()

users = await User.where("name", "Alice").or_where_null("deleted_at").get()
```

### Retrieving records

`get()` runs the query and returns a `Collection` of models:

```python
users = await User.where("is_active", True).get()

for user in users:
    print(user.email)
```

#### Chunking large result sets

Loading a large table with `all()` or `get()` can run your process out of memory. The `chunk` methods solve this by fetching one batch at a time. They return async iterators, so you loop over them with `async for`:

```python
async for users in User.chunk(200):
    for user in users:
        print(user.email)
```

Filtered queries can be chunked too:

```python
async for projects in Project.where("is_active", True).chunk(100):
    for project in projects:
        await project.archive()
```

`chunk(size)` pages with `limit` and `offset`. It stops when a batch is empty or smaller than `size`.

#### `chunk_by_id(size, column=None, alias=None)`

If you're changing rows while you loop, offsets can shift underneath you. `chunk_by_id` avoids that by paging on an increasing column instead. It orders by the primary key by default and fetches each batch with `column > last_id`, so rows added or removed during the loop don't cause skips or repeats:

```python
async for users in User.chunk_by_id(500):
    for user in users:
        await user.recalculate_score()
```

An `offset` already on the query applies to the first batch only. A `limit` caps the total number of rows, so `.limit(250)` chunked by 100 gives batches of 100, 100, and 50. Pass `column` to page by another column, and `alias` when that column is selected under a different name.

> `chunk_by_id` ignores any `order_by` on the query and raises `RuntimeError` if a row is missing the `alias` column.

#### `chunk_by_id_desc(size, column=None, alias=None)`

This works just like `chunk_by_id`, but walks from the highest id down, using `column < last_id`:

```python
async for projects in Project.chunk_by_id_desc(100):
    for project in projects:
        await project.archive()
```

> All three chunk methods raise `ValueError` if the batch size is not a positive integer.

### Subquery selects

Sometimes you want a value from another table alongside each row. You can select a subquery as an extra column for that. For example, this loads every user with the time of their latest login, all in one query:

```python
users = await (
    User.query()
    .add_select({
        "last_login_at": Login.query()
        .select("created_at")
        .where_column("user_id", "users.id")
        .latest()
        .limit(1)
    })
    .get()
)

users[0].serialize()["last_login_at"]
```

```sql
SELECT "users".*, (SELECT "logins"."created_at" FROM "logins" WHERE user_id = users.id ORDER BY "created_at" DESC LIMIT 1) AS last_login_at FROM "users"
```

#### `select_sub(subquery, alias)`

Adds `(subquery) AS alias` to the selected columns. `subquery` is either a query builder, or a callable that receives an empty builder with no table set and returns the subquery:

```python
posts = await (
    Post.query()
    .select("id")
    .select_sub(
        lambda q: q.table("categories")
        .select("name")
        .where_column("categories.id", "posts.category_id")
        .limit(1),
        "category_name",
    )
    .get()
)
```

```sql
SELECT "posts"."id", (SELECT "categories"."name" FROM "categories" WHERE categories.id = posts.category_id LIMIT 1) AS category_name FROM "posts"
```

Passing a builder instead of a callable gives the same SQL:

```python
category_name = Category.query().select("name").where_column("categories.id", "posts.category_id").limit(1)

posts = await Post.query().select("id").select_sub(category_name, "category_name").get()
```

Bindings from the subquery come before bindings from the outer `WHERE` clause, so `?` placeholders stay in order. Anything other than a builder or a callable raises `TypeError`.

#### `add_select(*columns)`

`add_select` adds columns to the selection instead of replacing it. You can pass the columns as separate arguments or as one list, and a column that's already selected won't be added twice:

```python
Post.query().select("id").add_select("title", "category_id")
Post.query().select("id").add_select(["title", "category_id"])
Post.query().select("id", "title").add_select("title", "category_id")
```

All three produce:

```sql
SELECT "posts"."id", "posts"."title", "posts"."category_id" FROM "posts"
```

To add a subquery column, pass a `{alias: subquery}` dict instead. The subquery can be a builder or a callable, and each entry is passed to `select_sub(subquery, alias)`. You can mix plain columns and dicts in one list:

```python
Post.query().select("id").add_select({"category_name": category_name})
Post.query().add_select(["id", {"category_name": category_name}])
```

If nothing is selected yet, `add_select` selects `{table}.*` first, so the model's own columns come back next to the subquery column:

```python
Post.query().add_select({"category_name": category_name})
```

```sql
SELECT "posts".*, (SELECT "categories"."name" FROM "categories" WHERE categories.id = posts.category_id LIMIT 1) AS category_name FROM "posts"
```

There are two edge cases to keep in mind:

- A string dict value is a plain column, and the key is ignored. `add_select({"ignored": "title"})` is the same as `add_select("title")`.
- A subquery without an alias, such as `add_select(Category.query().select("name"))`, raises `TypeError`. Wrap it in a dict or use `select_sub()`.

::: warning Migrating from `add_select(alias, callable)`
Older versions added a subquery column with `add_select(alias, callable)`. That form has been removed; `add_select` now only takes columns. Use `select_sub`, and note that the arguments are in the opposite order:

```python
# Before
Post.query().add_select("category_name", lambda q: ...)

# After
Post.query().select_sub(lambda q: ..., "category_name")
# or
Post.query().add_select({"category_name": lambda q: ...})
```
:::

#### `table(name)`

`table` changes the table the builder queries. You'll mostly need it inside a `select_sub` callable, where the builder has no table yet, but it works on a model query as well:

```python
rows = await Post.query().table("categories").select("name").get()
```

```sql
SELECT "categories"."name" FROM "categories"
```

## Creating Records

### `create`

The easiest way to add a row is `create`. It takes a dict of attributes, inserts the row, and returns the model:

```python
post = await Post.create({
    "user_id": user.id,
    "title": "Hello World",
    "content": "My first post.",
})
```

### `first_or_create`

When you want to reuse a row if it already exists, use `first_or_create`. It returns the first row matching the first dict. If there isn't one, it creates one from both dicts merged:

```python
user = await User.first_or_create(
    {"email": "admin@example.com"},
    {"name": "Admin User", "password": "secret"}
)
```

### `insert` — bulk insert rows

For bulk work, `insert` writes one or many rows without building model instances:

```python
await User.insert({"email": "picard@example.com", "votes": 0})

await User.insert([
    {"email": "picard@example.com", "votes": 0},
    {"email": "janeway@example.com", "votes": 0},
])
```

> Unlike `create`, `insert` doesn't fire model events, set timestamps, or return models. Reach for it in bulk seeding and batch jobs.

## Updating Records

To update a row, change its attributes and call `save()`:

```python
user = await User.find(1)
user.name = "Jane Doe"
await user.save()
```

## Deleting Records

To remove a row, call `delete()` on the model:

```python
user = await User.find(1)
await user.delete()
```

## Accessing Attributes

Columns are available as attributes on the model:

```python
user = await User.first()
print(user.id)
print(user.name)
print(user.email)
print(user.created_at.diff_for_humans())  # pendulum datetime
```

## Complete Example

To tie it all together, here's the `Post` model from the example app, with its columns and relationships:

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

From here, head to [Relationships](./relationships) to learn how to declare relationships, or [Casts](./casts) for type conversion and value objects.
