---
outline: deep
title: Models
description: Define database models and query them with the FastAPI Startkit ORM.
keywords: orm, models, database, fastapi, active record
---

# Models

## Introduction

A model is a class that maps to one database table. You use it to query, insert, update, and delete rows in that table, and each instance represents a single row whose columns you read as ordinary Python attributes. Every method that touches the database is async, so you `await` it.

Before you start, configure a database connection as described in [Database: Getting Started](./).

- [Defining Models](#defining-models)
- [Generating a Model](#generating-a-model)
- [Retrieving Models](#retrieving-models)
- [Chunking Results](#chunking-results)
- [Querying JSON Columns](#querying-json-columns)
- [Subquery Selects](#subquery-selects)
- [Unions](#unions)
- [Inserting Models](#inserting-models)
- [Upserts](#upserts)
- [Updating Models](#updating-models)
- [Deleting Models](#deleting-models)

## Defining Models

To define a model, extend `Model` and annotate the table's columns with Python types:

```python
# app/models/User.py
from fastapi_startkit.masoniteorm import Model


class User(Model):
    name: str
    email: str
    password: str
    role: str
    is_active: bool
```

The annotations also decide how each value is converted when it's read and written, and which attributes `update()` and `fill()` may set. See [Casts](./casts) for the supported types. This `User` matches the `users` table in [A Complete Example](./migrations#a-complete-example).

### Table Names

By default, the table name is the class name in snake_case, pluralized: `User` uses `users` and `ReviewLog` uses `review_logs`. If your table has another name, set `__table__`:

```python
class PostTag(Model):
    __table__ = "post_tag"
```

### Primary Keys

The model assumes the primary key column is `id`. Set `__primary_key__` to use another column:

```python
class Country(Model):
    __primary_key__ = "code"
```

### Timestamps

The model fills in `created_at` and `updated_at` when it saves. If a table doesn't have those columns, set `__timestamps__ = False`:

```python
class PostTag(Model):
    __table__ = "post_tag"
    __timestamps__ = False
```

### Database Connection

A model uses the default connection. To use another one, set `__connection__` to its name, as described in [Using Multiple Database Connections](./#using-multiple-database-connections):

```python
class Report(Model):
    __connection__ = "reporting"
```

## Generating a Model

Run `db:make:model` from the project root. It writes a model class into `app/models/` under the current directory, creating the directory if needed:

```bash
uv run python artisan db:make:model Post -m
```

The file is named after the class, `app/models/Post.py`. These options are available:

| Option | Effect |
|---|---|
| `-m`, `--migration` | Also creates a `create_posts_table` migration |
| `-s`, `--seeder` | Also creates a seeder |
| `-p`, `--pep` | Uses a snake_case file name, `app/models/post.py` |
| `-d`, `--directory` | Writes the model to another directory |

The migration and seeder generators create their directories too, so you can run `db:migrate` right after `db:make:model Post -m`.

## Retrieving Models

Once you have a model, you can query its table. `all()` returns every row:

```python
users = await User.all()

for user in users:
    print(user.email)
```

Columns are attributes on each model. Timestamps come back as `Carbon` instances:

```python
user = await User.first()

user.name
user.created_at.diff_for_humans()  # "a few seconds ago"
```

### Building Queries

Each model is also a query builder. Add constraints with `where`, then call `get()` to run the query:

```python
posts = await Post.where("user_id", 1).order_by("created_at", "desc").limit(10).get()
```

To fetch one row, use `first()` or look up a primary key with `find()`. Both return `None` when nothing matches:

```python
user = await User.find(1)

user = await User.where("email", "admin@example.com").first()
```

`find_or_fail()` and `first_or_fail()` raise `ModelNotFoundException` instead:

```python
from fastapi_startkit.masoniteorm import ModelNotFoundException

user = await User.find_or_fail(1)

user = await User.where("email", "admin@example.com").first_or_fail()
```

### Or and Raw Conditions

Chain `or_where` for an `OR` condition. `where_null`, `where_not_null`, and `where_in` add the matching checks, and `or_where_null` and `or_where_not_null` add them with `OR`:

```python
users = await User.where("role", "admin").or_where("role", "moderator").get()

users = await User.where("name", "Alice").or_where_null("role").get()
```

For a condition the builder can't express, use `where_raw` or `or_where_raw`. Pass values as a tuple of bindings:

```python
users = await User.where_raw("length(name) > ?", (20,)).get()

users = await User.where("is_active", True).or_where_raw("role = 'superadmin'").get()
```

### Counting and Checking Existence

`count()` returns the number of matching rows, and `exists()` tells you whether there are any:

```python
total = await User.count()
active = await User.where("is_active", True).count()

has_active = await User.where("is_active", True).exists()
```

### Paginating Results

`paginate(per_page, page)` returns one page of models and the total count. Start it from `query()` or a `where`:

```python
page = await User.query().paginate(per_page=15, page=1)

page.result     # the User instances on this page
page.total      # number of matching rows
page.last_page  # last page number
```

The paginator also has `current_page`, `next_page`, and `previous_page`. When you don't need the total, `simple_paginate(per_page, page)` skips the count query.

## Chunking Results

Loading a large table with `all()` or `get()` can run your process out of memory. The chunk methods fetch one batch at a time and return async iterators, so you loop over them with `async for`:

```python
async for users in User.where("is_active", True).chunk(100):
    for user in users:
        print(user.email)
```

`chunk(size)` pages with `limit` and `offset`, and stops when a batch is empty or smaller than `size`.

### Chunking by ID

If you change rows while you loop, offsets can shift and rows get skipped or repeated. `chunk_by_id(size, column=None, alias=None)` pages on the primary key instead, fetching each batch with `id > last_id`:

```python
async for users in User.chunk_by_id(500):
    for user in users:
        await user.update({"is_active": False})
```

`chunk_by_id_desc` walks from the highest id down. Both methods work like this:

- They ignore any `order_by` on the query.
- An `offset` on the query applies to the first batch only.
- A `limit` caps the total, so `.limit(250)` chunked by 100 gives batches of 100, 100, and 50.
- Pass `column` to page by another increasing column, and `alias` when that column is selected under another name. A row without the `alias` column raises `RuntimeError`.

All chunk methods raise `ValueError` if the size is zero or negative.

## Querying JSON Columns

To reach a key inside a JSON column, join the column and its keys with `->`. This works anywhere the builder takes a column name, including `where`, `or_where`, `order_by`, and `select`:

```python
posts = await Post.where("settings->headline", "like", "%Paris%").get()

posts = await Post.where("settings->meta->lang", "fr").order_by("settings->headline").get()

rows = await Post.query().select("id", "settings->headline as headline").get()
```

Each database gets its own JSON syntax:

| Database | `settings->meta->headline` compiles to |
|---|---|
| PostgreSQL | `"posts"."settings"->'meta'->>'headline'` |
| SQLite | `json_extract("posts"."settings", '$."meta"."headline"')` |
| MySQL | ``json_unquote(json_extract(`posts`.`settings`, '$."meta"."headline"'))`` |

String comparisons and `like` behave the same everywhere, and on PostgreSQL `like` compiles to `ILIKE`. Numbers and booleans don't: PostgreSQL's `->>` returns text, so compare those with `where_raw` and a cast for your database:

```python
# PostgreSQL
posts = await Post.where_raw("(settings->>'count')::int = ?", (5,)).get()

# SQLite
posts = await Post.where_raw("json_extract(settings, '$.count') = ?", (5,)).get()
```

Values are always bindings, but keys are written into the SQL, so a key may only contain letters, digits, and underscores. Anything else raises `ValueError`, so write `settings->headline`, not `settings->>headline`. For array indexes (`tags->0`) and containment checks, use `where_raw`.

## Subquery Selects

To load a value from another table alongside each row, select a subquery as an extra column. For example, this loads every user with the time of their latest login in one query:

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

### Using `select_sub`

`select_sub(subquery, alias)` adds `(subquery) AS alias` to the selected columns. The subquery is a query builder, or a callable that receives an empty builder and returns one. Call `table()` on that builder to choose its table:

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

Bindings from the subquery come before the outer query's bindings, so `?` placeholders stay in order. Anything other than a builder or a callable raises `TypeError`.

### Using `add_select`

`add_select` adds columns to the selection instead of replacing it. Pass the columns as arguments or as one list. A column that's already selected isn't added twice:

```python
Post.query().select("id").add_select("title", "category_id")
Post.query().select("id", "title").add_select(["title", "category_id"])
```

Both produce:

```sql
SELECT "posts"."id", "posts"."title", "posts"."category_id" FROM "posts"
```

To add a subquery column, pass a `{alias: subquery}` dict, as in the login example above. You can mix plain columns and dicts in one list. If nothing is selected yet, `add_select` selects `{table}.*` first, so the model's own columns come back next to the subquery column:

```python
category_name = Category.query().select("name").where_column("categories.id", "posts.category_id").limit(1)

Post.query().add_select(["id", {"category_name": category_name}])
Post.query().add_select({"category_name": category_name})
```

A subquery passed without an alias, such as `add_select(Category.query().select("name"))`, raises `TypeError`.

## Unions

`union` and `union_all` combine the rows of two queries. `union` removes duplicate rows and `union_all` keeps them. Each takes a query builder or a callable:

```python
user_ids = await (
    ReviewLog.query()
    .select("user_id")
    .where("created_at", ">", since)
    .union_all(Play.query().select("user_id").where("created_at", ">", since))
    .get()
)

user_ids = await (
    ReviewLog.query()
    .select("user_id")
    .union(lambda q: q.table("plays").select("user_id"))
    .get()
)
```

On PostgreSQL, the query compiles to:

```sql
(SELECT "review_logs"."user_id" FROM "review_logs" WHERE "review_logs"."created_at" > ?) UNION ALL (SELECT "plays"."user_id" FROM "plays" WHERE "plays"."created_at" > ?)
```

The queries must select the same number of columns. Each query keeps its own `order_by` and `limit`. `count()`, the other aggregates, `paginate()`, `simple_paginate()`, and the chunk methods work on the whole union:

```python
total = await ReviewLog.query().select("user_id").union(Play.query().select("user_id")).count()

page = await ReviewLog.query().select("user_id").union_all(Play.query().select("user_id")).paginate(per_page=20)
```

### Selecting From a Subquery

To filter, group, or order a union as a whole, select from it with `from_sub(subquery, alias)`. The outer query's columns, `where`, `group_by`, and `order_by` are prefixed with the alias. For example, this counts distinct users per day across two tables:

```python
events = (
    ReviewLog.query()
    .select("user_id", "day")
    .union_all(Play.query().select("user_id", "day"))
)

rows = await (
    ReviewLog.from_sub(events, "events")
    .select("day")
    .select_raw("COUNT(DISTINCT user_id) AS learners")
    .group_by("day")
    .get()
)
```

Because the outer `group_by` is prefixed with the alias, a computed column has to be selected inside each subquery, where it becomes a real column. `INTERSECT`, `EXCEPT`, and `GROUPING SETS` aren't supported.

## Inserting Models

To add a row, pass a dict of attributes to `create`. It inserts the row, fills in the timestamps, and returns the model:

```python
post = await Post.create({
    "user_id": user.id,
    "title": "Hello World",
    "content": "My first post.",
})
```

### Finding or Creating Models

`first_or_create(search, attributes)` returns the first row matching `search`. If there's none, it creates one from both dicts merged:

```python
user = await User.first_or_create(
    {"email": "admin@example.com"},
    {"name": "Admin User", "password": "secret"},
)
```

`update_or_create(search, attributes)` works the same way, but updates the found row with `attributes`:

```python
user = await User.update_or_create({"email": "admin@example.com"}, {"name": "Administrator"})
```

### Inserting Many Rows

`insert` writes one or many rows without building models:

```python
await User.insert([
    {"name": "Picard", "email": "picard@example.com", "password": "secret"},
    {"name": "Janeway", "email": "janeway@example.com", "password": "secret"},
])
```

Unlike `create`, `insert` doesn't fire model events, set timestamps, or return models. Use it for seeding and batch jobs.

## Upserts

`first_or_create` and `update_or_create` run a `SELECT` and then an `INSERT`. If two requests do that at the same moment, both miss the row and the second insert fails on the unique index. `insert_or_ignore` and `upsert` let the database resolve the conflict in a single statement.

`insert_or_ignore(values, unique_by=None)` inserts the rows and skips any row that would break a unique constraint:

```python
await Lexeme.insert_or_ignore(
    {"slug": "chat", "language": "fr", "word": "chat"},
    unique_by=["slug", "language"],
)  # 1 the first time, 0 after that
```

`upsert(values, unique_by, update=None)` inserts the rows, and updates the `update` columns of rows that already exist:

```python
await Lexeme.upsert(
    [
        {"slug": "chat", "language": "fr", "word": "chat"},
        {"slug": "dog", "language": "en", "word": "dog"},
    ],
    unique_by=["slug", "language"],
    update=["word"],
)
```

On PostgreSQL and SQLite, these compile to `ON CONFLICT`:

```sql
INSERT INTO "lexemes" ("slug", "language", "word") VALUES (?, ?, ?) ON CONFLICT ("slug", "language") DO NOTHING
INSERT INTO "lexemes" ("slug", "language", "word") VALUES (?, ?, ?) ON CONFLICT ("slug", "language") DO UPDATE SET "word" = EXCLUDED."word"
```

Both methods follow these rules:

- `values` is a dict or a list of dicts, and every row must have the same columns as the first, or a `ValueError` is raised. Key order doesn't matter.
- `unique_by` and `update` take a column name or a list of names.
- They return the number of affected rows. An empty `values` runs nothing and returns `0`.
- Like `insert`, they don't fire model events or fill in timestamps.
- Without `unique_by`, `insert_or_ignore` skips a conflict on any unique index.
- `upsert` needs at least one `unique_by` column. With `update=None`, it updates every inserted column that isn't in `unique_by`, and falls back to `insert_or_ignore` if that leaves nothing.
- Every `update` column must be one of the inserted columns, or `upsert` raises `ValueError`.
- On PostgreSQL, a batch that repeats a `unique_by` key fails, so send each key once per batch. SQLite applies the repeats in order and keeps the last one.

SQLite needs version 3.24 or later.

### Upserts on MySQL

On MySQL, `insert_or_ignore` compiles to `INSERT IGNORE` and `upsert` to `ON DUPLICATE KEY UPDATE`:

```sql
INSERT IGNORE INTO `lexemes` (`slug`, `language`, `word`) VALUES (?, ?, ?)
INSERT INTO `lexemes` (`slug`, `language`, `word`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `word` = VALUES(`word`)
```

Keep these differences in mind:

- MySQL finds the conflicting unique index itself, so `unique_by` isn't part of the SQL. `upsert` still requires it to work out the default `update` columns.
- `INSERT IGNORE` also turns other errors, such as a `NOT NULL` violation, a failed foreign key, or a value too long for its column, into warnings. The row is then skipped or stored with an adjusted value.
- MySQL counts an inserted row as 1, an updated row as 2, and an unchanged matched row as 1. Don't rely on the exact count across databases.

## Updating Models

To update a model, change its attributes and call `save()`:

```python
user = await User.find(1)
user.name = "Jane Doe"
await user.save()
```

`update()` sets several attributes and saves them in one call, and `touch()` only refreshes `updated_at`. `update()` and `fill()` set only the attributes annotated on the model and skip other keys without an error, and so does `update_or_create()` when it finds an existing row. `create()`, `first_or_create()`, and `update_or_create()` when no row matches write every key you pass:

```python
await user.update({"name": "Jane Smith", "role": "editor"})

await user.touch()
```

To update every row a query matches, call `update` on the query. It returns the number of affected rows and doesn't fire model events:

```python
await User.where("role", "moderator").update({"is_active": True})
```

## Deleting Models

To delete a model, call `delete()` on it:

```python
user = await User.find(1)
await user.delete()
```

To delete every row a query matches, call `delete` on the query. It returns the number of deleted rows:

```python
await User.where("is_active", False).delete()
```

See [Relationships](./relationships) to connect models to each other, and [Casts](./casts) to control how attributes are converted.
