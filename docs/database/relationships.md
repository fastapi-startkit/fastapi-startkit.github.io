---
outline: deep
title: Relationships
description: Define, eager load, and query database relationships (one to one, one to many, many to many, has one of many, has through, and polymorphic) with the FastAPI Startkit ORM.
keywords: orm, relationships, database, foreign keys, eager loading, polymorphic, fastapi
---

# Relationships

Database tables are rarely islands. A post has an author, a user writes many posts, and a post can carry many tags. Relationships let you describe those connections once, on the model, and then load related records without writing joins by hand.

## Defining Relationships

You declare a relationship as a class attribute on the model. Put the related model's name in square brackets, then pass the keys as keyword arguments:

```python
from fastapi_startkit.masoniteorm import Model, BelongsTo, HasMany

class Post(Model):
    __table__ = "posts"

    id: int
    user_id: int
    title: str

    author = BelongsTo["User"](local_key="user_id", foreign_key="id")
    comments = HasMany["Comment"](foreign_key="post_id", local_key="id")
```

The name in brackets is a string, so the related model doesn't need to be imported when the module loads. Models register themselves by class name and the ORM resolves the string the first time the relationship is used. The bracket also gives type checkers the related model, so `post.author` is typed as `User | None` and `post.comments` as `Collection[Comment]`. If you want those hints to resolve in your editor, import the related models under `TYPE_CHECKING`:

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.comment import Comment
```

All relationship classes can be imported from `fastapi_startkit.masoniteorm` or from `fastapi_startkit.masoniteorm.relationships`.

::: tip Pass the keys explicitly
When a key is left out, its default is derived from the attribute name (for example `HasMany` falls back to `<attribute>_id`), which rarely matches your columns. Name both keys on every relationship. Pass them as keyword arguments, because the first positional argument is read as the related model.
:::

::: warning Deprecated: model name as the first argument
The older form, `BelongsTo("User", local_key="user_id")`, still works but raises a `DeprecationWarning` and will be removed in 1.x. Write `BelongsTo["User"](local_key="user_id")` instead.
:::

Declare the model's columns as annotations, as in the `Post` model above. The ORM only fills annotated columns, and helpers like `attach()` set the foreign key through that fill.

## One to One

### HasOne

Use `HasOne` when the related table holds a foreign key back to this model and there is at most one matching row, such as a user with one profile:

```python
HasOne["RelatedModel"](foreign_key=..., local_key=...)
```

| Parameter | Description |
|---|---|
| `foreign_key` | Column on the related model that references this model |
| `local_key` | Column on this model that the foreign key points at. Defaults to `"id"`. |

```python
# app/models/user.py
from fastapi_startkit.masoniteorm import Model, HasOne

class User(Model):
    __table__ = "users"

    id: int
    name: str

    profile = HasOne["Profile"](foreign_key="user_id", local_key="id")
```

When no related row exists, the loaded attribute is `None`.

### BelongsTo

`BelongsTo` is the inverse. Use it when this model holds the foreign key, such as a profile pointing at its user or a post pointing at its author:

```python
BelongsTo["RelatedModel"](local_key=..., foreign_key=...)
```

| Parameter | Description |
|---|---|
| `local_key` | Foreign key column on this model |
| `foreign_key` | Column on the related model that `local_key` references, usually its primary key |

```python
# app/models/profile.py
from fastapi_startkit.masoniteorm import Model, BelongsTo

class Profile(Model):
    __table__ = "profiles"

    id: int
    user_id: int
    bio: str

    user = BelongsTo["User"](local_key="user_id", foreign_key="id")
```

## One to Many

`HasMany` is like `HasOne`, but it loads every matching row as a `Collection`. Use it for a user with many posts or a post with many comments:

```python
HasMany["RelatedModel"](foreign_key=..., local_key=...)
```

| Parameter | Description |
|---|---|
| `foreign_key` | Column on the related model that references this model |
| `local_key` | Column on this model that the foreign key points at. Defaults to `"id"`. |

```python
# app/models/user.py
from fastapi_startkit.masoniteorm import Model, HasMany, HasOne

class User(Model):
    __table__ = "users"

    id: int
    name: str

    profile = HasOne["Profile"](foreign_key="user_id", local_key="id")
    posts = HasMany["Post"](foreign_key="user_id", local_key="id")
```

The inverse of `HasMany` is a `BelongsTo` on the child model, like `Post.author` above.

## Has One of Many

Sometimes you want a single row out of a `HasMany`, such as a post's latest comment. Derive it from the `HasMany` with `latest_of_many()`, `oldest_of_many()`, or `of_many()`, and declare it with the `@relationship` decorator:

```python
# app/models/post.py
from fastapi_startkit.masoniteorm import Model, BelongsTo, HasMany, HasOne, relationship

class Post(Model):
    __table__ = "posts"

    id: int
    user_id: int
    title: str

    author = BelongsTo["User"](local_key="user_id", foreign_key="id")
    comments = HasMany["Comment"](foreign_key="post_id", local_key="id")

    @relationship
    def latest_comment(self) -> HasOne["Comment"]:
        return self.comments.latest_of_many()

    @relationship
    def oldest_comment(self) -> HasOne["Comment"]:
        return self.comments.oldest_of_many()

    @relationship
    def top_comment(self) -> HasOne["Comment"]:
        return self.comments.of_many("votes", "max")
```

| Method | Picks the row with |
|---|---|
| `latest_of_many(column="created_at")` | The highest `column` value |
| `oldest_of_many(column="created_at")` | The lowest `column` value |
| `of_many(column=None, aggregate="max")` | The `"max"` or `"min"` value of `column`. With no column, the primary key is used. |

Rows where the column is `NULL` are skipped, and ties are broken by the primary key. The result behaves like a `HasOne`, so you can eager load it and use it with `where_has()`, and it is `None` when there are no rows. The method must return a new relationship derived from another one. `@relationship` also works on top of a `@classmethod`, in which case you write `cls.comments` instead of `self.comments`.

## Many to Many

Some relationships run both ways. A post can have many tags, and a tag can belong to many posts. Use `BelongsToMany` when a pivot table links two models like this:

```python
BelongsToMany["RelatedModel"](
    local_foreign_key=...,
    other_foreign_key=...,
    table=...,
)
```

| Parameter | Description |
|---|---|
| `local_foreign_key` | Pivot column that references this model |
| `other_foreign_key` | Pivot column that references the related model |
| `table` | Name of the pivot table |
| `local_owner_key` | Column on this model that the pivot references. Defaults to `"id"`. |
| `other_owner_key` | Column on the related model that the pivot references. Defaults to `"id"`. |
| `with_timestamps` | Read and write `created_at` / `updated_at` on the pivot table. Defaults to `False`. |
| `pivot_id` | Primary key column of the pivot table. Defaults to `"id"`. Set it to `None` if the pivot table has no id column. |
| `attribute` | Name of the attribute that holds the pivot row on each related model. Defaults to `"pivot"`. |
| `with_fields` | Extra pivot columns to load onto the pivot attribute, as a list |

So a `Post` belongs to many `Tag`s:

```python
# app/models/post.py
tags = BelongsToMany["Tag"](
    local_foreign_key="post_id",
    other_foreign_key="tag_id",
    table="post_tag",
)
```

And the inverse, where a `Tag` belongs to many `Post`s, uses the same pivot table with the keys swapped:

```python
# app/models/tag.py
posts = BelongsToMany["Post"](
    local_foreign_key="tag_id",
    other_foreign_key="post_id",
    table="post_tag",
)
```

### Attaching and Detaching

To add or remove a pivot row, call `attach()` or `detach()` on the relationship through the model class, passing the parent and the related record:

```python
await Post.tags.attach(post, tag)
await Post.tags.detach(post, tag)
```

`attach()` writes only the two pivot keys, plus the timestamps when `with_timestamps=True`. To fill other pivot columns, insert the row through a pivot model instead (see below).

### Reading the Pivot Row

Each related model loaded through a `BelongsToMany` has the pivot row on its `pivot` attribute:

```python
post = await Post.with_("tags").where("id", 1).first()

for tag in post.tags:
    print(tag.name, tag.pivot.post_id, tag.pivot.tag_id)
```

Rename the attribute with `attribute=`, and load extra pivot columns with `with_fields=`:

```python
# app/models/team.py
members = BelongsToMany["User"](
    local_foreign_key="team_id",
    other_foreign_key="user_id",
    table="team_user",
    pivot_id=None,
    attribute="membership",
    with_fields=["role"],
)
```

```python
team = await Team.with_("members").first()
print(team.members[0].membership.role)
```

### Pivot Model

When you need to insert or query pivot rows directly, define a model for the pivot table:

```python
# app/models/post_tag.py
from fastapi_startkit.masoniteorm import Model

class PostTag(Model):
    __table__ = "post_tag"
    __timestamps__ = False

    id: int
    post_id: int
    tag_id: int
```

Then attaching a tag to a post, only if it isn't attached yet, is a single call:

```python
await PostTag.first_or_create({"post_id": post.id, "tag_id": tag.id})
```

## Has One Through

Use `HasOneThrough` when a model reaches one distant model through an intermediate model. Consider this schema:

```
IncomingShipment → (via from_port_id) → Port → (via port_country_id) → Country
```

The first argument is a list with the distant and intermediate model names, followed by the keys that connect them:

```python
HasOneThrough["DistantModel"](
    ["DistantModel", "IntermediateModel"],
    local_foreign_key,
    other_foreign_key,
    local_owner_key,
    other_owner_key,
)
```

| Parameter | Description |
|---|---|
| `["DistantModel", "IntermediateModel"]` | String names of the distant and intermediate models |
| `local_foreign_key` | Foreign key on this model that references the intermediate model |
| `other_foreign_key` | Foreign key on the intermediate model that references the distant model |
| `local_owner_key` | Primary key on the intermediate model |
| `other_owner_key` | Primary key on the distant model |

Putting it together, an `IncomingShipment` has one `Country` through `Port`:

```python
# app/models/incoming_shipment.py
from fastapi_startkit.masoniteorm import Model, HasOneThrough

class IncomingShipment(Model):
    __table__ = "incoming_shipments"
    __primary_key__ = "shipment_id"

    shipment_id: int
    name: str
    from_port_id: int

    from_country = HasOneThrough["Country"](
        ["Country", "Port"],
        "from_port_id",     # FK on IncomingShipment → Port
        "port_country_id",  # FK on Port → Country
        "port_id",          # PK on Port
        "country_id",       # PK on Country
    )
```

Eager load it and read it like any other relationship:

```python
shipments = await IncomingShipment.with_("from_country").get()
for shipment in shipments:
    print(shipment.from_country.name)
```

## Has Many Through

`HasManyThrough` works the same way, but for many distant models. Use it when a model reaches many distant models through an intermediate model, as in this schema:

```
Course → (via in_course_id on Enrolment) → Enrolment → (via active_student_id) → Student
```

The arguments mirror `HasOneThrough`, but the keys are read from the intermediate table's side:

```python
HasManyThrough["DistantModel"](
    ["DistantModel", "IntermediateModel"],
    local_foreign_key,
    other_foreign_key,
    local_owner_key,
    other_owner_key,
)
```

| Parameter | Description |
|---|---|
| `["DistantModel", "IntermediateModel"]` | String names of the distant and intermediate models |
| `local_foreign_key` | Foreign key on the intermediate model that references this model |
| `other_foreign_key` | Foreign key on the intermediate model that references the distant model |
| `local_owner_key` | Primary key on this model |
| `other_owner_key` | Primary key on the distant model |

Here, a `Course` has many `Student`s through `Enrolment`:

```python
# app/models/course.py
from fastapi_startkit.masoniteorm import Model, HasManyThrough

class Course(Model):
    __table__ = "courses"
    __primary_key__ = "course_id"

    course_id: int
    name: str

    students = HasManyThrough["Student"](
        ["Student", "Enrolment"],
        "in_course_id",      # FK on Enrolment → Course
        "active_student_id", # FK on Enrolment → Student
        "course_id",         # PK on Course
        "student_id",        # PK on Student
    )
```

```python
courses = await Course.with_("students").get()
for course in courses:
    print([student.name for student in course.students])
```

## Polymorphic Relationships

A polymorphic relationship lets one model belong to more than one kind of parent through a single pair of columns. For example, an `Image` can belong to a `Post` or a `Video`. The `images` table stores the parent's type in `imageable_type` and its id in `imageable_id`.

First, register a morph map so the ORM knows which model each stored type name stands for:

```python
from fastapi_startkit.masoniteorm.models.registry import Registry

Registry.morph_map({"post": Post, "video": Video})
```

Put this somewhere that runs once at startup, such as a service provider's `boot()` method.

Then declare `MorphTo` on the child and `MorphMany` on each parent. Both take the type column as `morph_key` and the id column as `morph_id`, which default to `record_type` and `record_id`:

```python
# app/models/image.py
from fastapi_startkit.masoniteorm import Model, MorphTo

class Image(Model):
    __table__ = "images"

    id: int
    imageable_type: str
    imageable_id: int
    url: str

    imageable = MorphTo("Image", morph_key="imageable_type", morph_id="imageable_id")
```

```python
# app/models/video.py
from fastapi_startkit.masoniteorm import Model, MorphMany

class Video(Model):
    __table__ = "videos"

    id: int
    title: str

    images = MorphMany("Image", morph_key="imageable_type", morph_id="imageable_id")
```

`MorphMany` takes the child model's name. `MorphTo` takes the name of the model it is declared on, and resolves each parent from the morph map. Both are eager loaded with `with_()`:

```python
images = await Image.with_("imageable").get()
for image in images:
    print(type(image.imageable).__name__)   # "Post" or "Video"

videos = await Video.with_("images").get()
```

## Eager Loading

Relationships are never loaded behind your back. Reading a relationship that hasn't been loaded raises `LazyLoadingViolation`, which keeps N+1 queries out of your app:

```python
post = await Post.where("id", 1).first()
post.author   # raises LazyLoadingViolation
```

To load relationships along with the query, pass their names to `with_()`. Each relationship is loaded with one extra query for the whole result set:

```python
posts = await Post.with_("author", "tags").get()

for post in posts:
    print(post.author.name)
    print([tag.name for tag in post.tags])
```

### Nested Eager Loading

Use dot notation to load a relationship of a relationship:

```python
users = await User.with_("posts.tags").get()

for user in users:
    for post in user.posts:
        print(post.title, [tag.name for tag in post.tags])
```

### Constraining Eager Loads

To filter or sort the related rows, pass a dict that maps the relationship name to a callback. The callback receives the related query builder:

```python
posts = await Post.with_({"comments": lambda q: q.where("votes", ">", 5)}).get()
```

### Lazy Eager Loading

If you already have a model or a collection, load relationships onto it with `load()`. On a collection, each relationship is still fetched with one query:

```python
post = await Post.where("id", 1).first()
await post.load("author", "comments")
print(post.author.name)

posts = await Post.all()
await posts.load("author")
```

## Querying Relationship Existence

Use `where_has()` to keep only the records that have at least one related row:

```python
posts = await Post.where_has("comments").get()
```

Pass a callback to put conditions on the related rows. The callback receives the related query builder:

```python
posts = await Post.where_has("comments", lambda q: q.where("votes", ">", 5)).get()

tagged = await Post.where_has("tags", lambda q: q.where("name", "python")).get()

from_usa = await IncomingShipment.where_has(
    "from_country", lambda q: q.where("name", "USA")
).get()
```

`or_where_has()` adds the same check joined with `OR`:

```python
posts = await Post.where("title", "Hello").or_where_has("comments").get()
```

Both work with `HasOne`, `HasMany`, `BelongsTo`, `BelongsToMany`, has one of many, `HasOneThrough`, and `HasManyThrough`, including relationships that point back at the same table.

## Full Model Reference

For reference, here's the complete `Post` model with `BelongsTo`, `HasMany`, has one of many, and `BelongsToMany`:

```python
# app/models/post.py
from typing import TYPE_CHECKING
from fastapi_startkit.masoniteorm import Model, BelongsTo, BelongsToMany, HasMany, HasOne, relationship

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.comment import Comment
    from app.models.tag import Tag

class Post(Model):
    __table__ = "posts"

    id: int
    user_id: int
    title: str
    content: str

    author = BelongsTo["User"](local_key="user_id", foreign_key="id")
    comments = HasMany["Comment"](foreign_key="post_id", local_key="id")
    tags = BelongsToMany["Tag"](
        local_foreign_key="post_id",
        other_foreign_key="tag_id",
        table="post_tag",
    )

    @relationship
    def latest_comment(self) -> HasOne["Comment"]:
        return self.comments.latest_of_many()
```
