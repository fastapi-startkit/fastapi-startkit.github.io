---
outline: deep
title: Retrieving Models
description: Retrieve records with the Fastapi Startkit async ORM — fetch collections, build queries, load single models, and iterate large result sets with chunking.
keywords: orm, retrieving models, query builder, chunk, async, fastapi, active record
---

# Retrieving Models

Once you have [defined a model](./models) and its underlying table, you are ready to start reading data. Each model exposes an async query builder that lets you fluently query the table it maps to.

::: tip
Every method that touches the database is **async** and must be awaited. Query-building methods such as `where`, `order_by`, and `limit` are synchronous and chainable — the query only runs when you `await` a terminal method like `get`, `first`, or `all`.
:::

## Retrieving All Models

Use `all()` to fetch every row in the table. It returns a `Collection` of hydrated model instances that you can iterate over:

```python
from app.models.user import User

users = await User.all()

for user in users:
    print(user.name)
```

Once you start constraining a query with the builder, call `get()` to run it and retrieve the matching records:

```python
active_users = await User.where("is_active", True).get()
```

Both `all()` and `get()` return a `Collection`, so you can iterate it directly, check its length with `len(users)`, or reach for helpers such as `first()` and `last()`.

## Building Queries

The query builder is chainable: each constraint returns the same builder, so you can compose `where`, `order_by`, and `limit` before executing the query. The query is sent to the database only when you await a terminal method.

### Constraining with `where`

```python
users = await User.where("is_active", True).get()

# Supply an explicit operator as the middle argument
users = await User.where("votes", ">", 100).get()
```

### Ordering results

`order_by` accepts a column and an optional direction (`"asc"` by default):

```python
users = await User.order_by("created_at", "desc").get()
```

### Limiting results

Use `limit` to cap the number of rows returned. Pair it with `offset` to skip rows:

```python
top_users = await User.order_by("votes", "desc").limit(10).get()

next_page = await User.order_by("votes", "desc").limit(10).offset(10).get()
```

### Chaining it together

Because each method returns the builder, constraints read as a single fluent chain:

```python
recent_admins = (
    await User.where("role", "admin")
    .where("is_active", True)
    .order_by("created_at", "desc")
    .limit(25)
    .get()
)
```

## Retrieving Single Models

To retrieve a single record instead of a `Collection`, use `first()` or `find()`.

### `first()`

`first()` runs the current query and returns the first matching model, or `None` if nothing matches:

```python
user = await User.where("email", "admin@example.com").first()
```

### `find()`

`find()` retrieves a record by its primary key:

```python
user = await User.find(1)
```

If you need to raise when no record is found instead of receiving `None`, use `find_or_fail()` or `first_or_fail()`, which raise `ModelNotFoundException`. These are covered in the [Models](./models) reference.

## Chunking Results

When you need to process thousands (or millions) of records, loading them all at once with `all()` or `get()` can exhaust memory. The `chunk` methods retrieve a small slice of records at a time and hand each batch to your loop, keeping memory usage flat.

Both methods return an async iterator, so you consume them with `async for`.

### `chunk(size)`

`chunk(size)` walks the table using `limit`/`offset` paging, yielding a `Collection` of at most `size` records per iteration. Iteration stops automatically once a batch comes back empty or shorter than `size`:

```python
from app.models.project import Project

async for projects in Project.where("is_active", True).chunk(100):
    for project in projects:
        await project.mark_reviewed()
```

You can call `chunk` directly on the model to walk the entire table:

```python
async for users in User.chunk(200):
    for user in users:
        print(user.email)
```

::: warning
Because `chunk` pages with `offset`, avoid updating or deleting records in a way that changes which rows match the query while you iterate — shifting rows can cause records to be skipped. When you need to modify results as you go, use `chunk_by_id` instead.
:::

### `chunk_by_id(size, column=None, alias=None)`

`chunk_by_id` pages using a "keyset" (also called cursor) strategy: instead of `offset`, it orders by an incrementing column and remembers the last id of each batch, filtering the next batch with `column > last_id`. This makes it safe to modify rows while iterating.

By default it pages by the model's primary key:

```python
async for projects in Project.where("is_active", True).chunk_by_id(100):
    for project in projects:
        await project.archive()
```

Pass `column` to page by a different incrementing column. Use `alias` when the paging column is selected under a different name (for example via a joined or aliased query) — its value is read from each row to compute the next cursor:

```python
async for users in User.chunk_by_id(500, column="id"):
    for user in users:
        await user.recalculate_score()
```

::: warning
`chunk_by_id` orders results by the paging column ascending and ignores any `order_by` you set on the query. The paging column should be unique and monotonically increasing (such as an auto-incrementing primary key) for iteration to cover every row.
:::

If the `alias` column is not present in the selected columns of a row, `chunk_by_id` cannot read the next cursor and raises a `RuntimeError`. Make sure the aliased keyset column is part of the query's selection.

### `chunk_by_id_desc(size, column=None, alias=None)`

`chunk_by_id_desc` is the descending counterpart of `chunk_by_id`. It uses the same keyset strategy but walks the table from the highest id to the lowest, ordering by the paging column descending and filtering each subsequent batch with `column < last_id`:

```python
async for projects in Project.where("is_active", True).chunk_by_id_desc(100):
    for project in projects:
        # projects arrive newest-id first, high -> low
        await project.archive()
```

Like `chunk_by_id`, it accepts `column` and `alias`, defaults to the model's primary key, and raises a `RuntimeError` if the `alias` column is missing from a row.

### `offset` and `limit` with keyset chunking

`chunk_by_id` and `chunk_by_id_desc` honour a pre-set `offset` and `limit`, which is useful for resuming or bounding a walk:

- **`offset`** is applied to the **first page only**. After the first batch, keyset filtering (`column > last_id` / `column < last_id`) drives every subsequent page, so the offset is not re-applied.
- **`limit`** uses **limit-remaining** semantics: the limit is a total cap on rows across all batches, not a per-batch size. Each batch fetches at most the smaller of the chunk size and the remaining allowance, and iteration stops once the allowance is exhausted.

For example, a limit of 250 chunked by 100 yields batches of **100 + 100 + 50**:

```python
# Skip the first 50 rows, then process at most 250 more in batches of 100
async for users in User.offset(50).limit(250).chunk_by_id(100):
    for user in users:
        await user.recalculate_score()
# -> batches of 100, 100, 50
```

`chunk` (offset/limit paging) does not support these semantics — it always walks the full result set in fixed-size batches.

All three methods — `chunk`, `chunk_by_id`, and `chunk_by_id_desc` — raise a `ValueError` if the batch size is not a positive integer.
