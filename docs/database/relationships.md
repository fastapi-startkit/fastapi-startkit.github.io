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

Pass the keys as keyword arguments, because the first positional argument is read as the related model.

### Default Keys

If your columns follow the usual naming convention, you can leave the keys out. A missing key is filled in, Laravel style, from the model **class names** and their `__primary_key__`. A model's foreign key name is its snake_cased class name followed by its primary key, so `User` gives `user_id`, `BlogPost` gives `blog_post_id`, and a model with `__primary_key__ = "uuid"` gives `..._uuid`:

| Relationship | Default keys |
|---|---|
| `HasOne`, `HasMany` | `local_key` is the owner's primary key, and `foreign_key` is the owner's foreign key name (`User.posts` → `posts.user_id`) |
| `BelongsTo` | `local_key` is `{attribute}_{related primary key}`, and `foreign_key` is the related primary key (`Post.author` → `posts.author_id`) |
| `BelongsToMany` | The pivot `table` is the two snake_cased class names in alphabetical order, joined with `_` (`Post` and `Tag` → `post_tag`). `local_foreign_key` and `other_foreign_key` are each side's foreign key name (`post_id`, `tag_id`). |
| `HasOneThrough` | The intermediate model holds the owner's foreign key, and the distant model holds the intermediate model's foreign key (`Novelist` → `essays.novelist_id` → `media.essay_id`) |

```python
class Post(Model):
    user = BelongsTo["User"]()       # posts.user_id → users.id
    comments = HasMany["Comment"]()  # comments.post_id → posts.id
    tags = BelongsToMany["Tag"]()    # post_tag.post_id / post_tag.tag_id
```

A few things to keep in mind:

- The names come from the class, never from `__table__`. A `Label` model with `__table__ = "blog_labels"` still gives `label_id`, and its pivot with `Essay` is `essay_label`.
- Class names aren't singularized or pluralized. `Media` gives `media_id`, and its pivot with `Label` is `label_media`.
- A relationship inherited by a subclass takes its keys from the subclass. If `Invoice` extends `BaseItem`, an inherited `HasMany` uses `invoice_id`.
- Only the relationships in the table above have default keys. `HasManyThrough` and the morph relationships still need every key passed explicitly.
- Any key you pass explicitly wins. When your columns don't follow the convention, pass every key, as the examples on this page do.

::: warning Upgrading to v0.75.0
Before v0.75.0, some defaults were different. If you relied on one of them, pass the old name explicitly:

- `HasOne` and `HasMany` used `{attribute}_id` as the foreign key (`posts_id`). They now use the owner's foreign key name (`user_id`).
- A `BelongsToMany` without `table=` built the pivot name from the tables. For `CpItemModel` (`__table__ = "cp_items"`) and `CpShopModel` (`__table__ = "cp_shops"`), that gave `cp_item_cp_shop`. It now comes from the class names, so the pivot is `cp_item_model_cp_shop_model`. Pass `table="cp_item_cp_shop"` to keep the old one.
- Irregular plurals used to be singularized (`medium_tag`). The class name is now used as is (`media_tag`).
- A subclass that shares its parent's table and inherits a `BelongsToMany` now gets a pivot name based on the subclass. Set `table=` on the parent to keep the old one.

The pivot foreign keys follow the same class-name rule. Pass `local_foreign_key=` and `other_foreign_key=` to keep the old ones.
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

#### Table Structure

```text
users
    id - integer
    name - string

profiles
    id - integer
    user_id - integer
    bio - string
```

`profiles.user_id` references `users.id`, so a user has one profile.

#### Model Structure

```python
# app/models/user.py
from fastapi_startkit.masoniteorm import Model, HasOne

class User(Model):
    __table__ = "users"

    id: int
    name: str

    profile = HasOne["Profile"](foreign_key="user_id", local_key="id")
```

```python
# app/models/profile.py
from fastapi_startkit.masoniteorm import Model

class Profile(Model):
    __table__ = "profiles"

    id: int
    user_id: int
    bio: str
```

```python
user = await User.with_("profile").where("id", 1).first()
print(user.profile.bio)
```

When no related row exists, the loaded attribute is `None`.

### BelongsTo

`BelongsTo` is the inverse. Use it when this model holds the foreign key, such as a user that belongs to a role:

```python
BelongsTo["RelatedModel"](local_key=..., foreign_key=...)
```

| Parameter | Description |
|---|---|
| `local_key` | Foreign key column on this model |
| `foreign_key` | Column on the related model that `local_key` references, usually its primary key |

#### Table Structure

```text
users
    id - integer
    role_id - integer
    name - string

roles
    id - integer
    name - string
```

`users.role_id` references `roles.id`, so a user belongs to a role.

#### Model Structure

```python
# app/models/user.py
from fastapi_startkit.masoniteorm import Model, BelongsTo

class User(Model):
    __table__ = "users"

    id: int
    role_id: int
    name: str

    role = BelongsTo["Role"](local_key="role_id", foreign_key="id")
```

```python
# app/models/role.py
from fastapi_startkit.masoniteorm import Model

class Role(Model):
    __table__ = "roles"

    id: int
    name: str
```

```python
user = await User.with_("role").where("id", 1).first()
print(user.role.name)
```

The inverse of the `HasOne` above is a `BelongsTo` too: `Profile.user = BelongsTo["User"](local_key="user_id", foreign_key="id")`.

## One to Many

`HasMany` is like `HasOne`, but it loads every matching row as a `Collection`. Use it for a user with many posts:

```python
HasMany["RelatedModel"](foreign_key=..., local_key=...)
```

| Parameter | Description |
|---|---|
| `foreign_key` | Column on the related model that references this model |
| `local_key` | Column on this model that the foreign key points at. Defaults to `"id"`. |

#### Table Structure

```text
users
    id - integer
    name - string

posts
    id - integer
    user_id - integer
    title - string
```

`posts.user_id` references `users.id`, so a user has many posts and each post belongs to one user.

#### Model Structure

```python
# app/models/user.py
from fastapi_startkit.masoniteorm import Model, HasMany

class User(Model):
    __table__ = "users"

    id: int
    name: str

    posts = HasMany["Post"](foreign_key="user_id", local_key="id")
```

```python
# app/models/post.py
from fastapi_startkit.masoniteorm import Model, BelongsTo

class Post(Model):
    __table__ = "posts"

    id: int
    user_id: int
    title: str

    author = BelongsTo["User"](local_key="user_id", foreign_key="id")
```

```python
user = await User.with_("posts").where("id", 1).first()
print([post.title for post in user.posts])
```

`Post.author` is the inverse `BelongsTo`.

## Has One of Many

Sometimes you want a single row out of a `HasMany`, such as a post's latest comment. Derive it from the `HasMany` with `latest_of_many()`, `oldest_of_many()`, or `of_many()`, and declare it with the `@relationship` decorator.

| Method | Picks the row with |
|---|---|
| `latest_of_many(column="created_at")` | The highest `column` value |
| `oldest_of_many(column="created_at")` | The lowest `column` value |
| `of_many(column=None, aggregate="max")` | The `"max"` or `"min"` value of `column`. With no column, the primary key is used. |

#### Table Structure

```text
posts
    id - integer
    title - string

comments
    id - integer
    post_id - integer
    body - string
    votes - integer
    created_at - timestamp
```

`comments.post_id` references `posts.id`, so a post has many comments, and one of them is the latest, the oldest, or the most voted.

#### Model Structure

```python
# app/models/post.py
from fastapi_startkit.masoniteorm import Model, HasMany, HasOne, relationship

class Post(Model):
    __table__ = "posts"

    id: int
    title: str

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

```python
# app/models/comment.py
from fastapi_startkit.masoniteorm import Model

class Comment(Model):
    __table__ = "comments"

    id: int
    post_id: int
    body: str
    votes: int
```

```python
post = await Post.with_("latest_comment", "top_comment").where("id", 1).first()
print(post.latest_comment.body, post.top_comment.votes)
```

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

#### Table Structure

```text
posts
    id - integer
    title - string

tags
    id - integer
    name - string

post_tag
    id - integer
    post_id - integer
    tag_id - integer
```

Each `post_tag` row links one post to one tag: `post_tag.post_id` references `posts.id` and `post_tag.tag_id` references `tags.id`.

#### Model Structure

```python
# app/models/post.py
from fastapi_startkit.masoniteorm import Model, BelongsToMany

class Post(Model):
    __table__ = "posts"

    id: int
    title: str

    tags = BelongsToMany["Tag"](
        local_foreign_key="post_id",
        other_foreign_key="tag_id",
        table="post_tag",
    )
```

```python
# app/models/tag.py
from fastapi_startkit.masoniteorm import Model, BelongsToMany

class Tag(Model):
    __table__ = "tags"

    id: int
    name: str

    posts = BelongsToMany["Post"](
        local_foreign_key="tag_id",
        other_foreign_key="post_id",
        table="post_tag",
    )
```

The inverse on `Tag` uses the same pivot table with the keys swapped.

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

Rename the attribute with `attribute=`, and load extra pivot columns with `with_fields=`. Here the pivot table has no `id` column and stores each member's position:

```text
teams
    id - integer
    name - string

users
    id - integer
    name - string

team_user
    team_id - integer
    user_id - integer
    position - string
```

```python
# app/models/team.py
from fastapi_startkit.masoniteorm import Model, BelongsToMany

class Team(Model):
    __table__ = "teams"

    id: int
    name: str

    members = BelongsToMany["User"](
        local_foreign_key="team_id",
        other_foreign_key="user_id",
        table="team_user",
        pivot_id=None,
        attribute="membership",
        with_fields=["position"],
    )
```

```python
team = await Team.with_("members").first()
print(team.members[0].membership.position)
```

Name `with_fields` columns so they don't clash with an attribute or relationship on the related model. Here a pivot column called `role` would collide with `User.role` and break eager loading.

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

Use `HasOneThrough` when a model reaches one distant model through an intermediate model. The first argument is a list with the distant and intermediate model names, followed by the keys that connect them:

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

#### Table Structure

```text
incoming_shipments
    shipment_id - integer
    from_port_id - integer
    name - string

ports
    port_id - integer
    port_country_id - integer
    name - string

countries
    country_id - integer
    name - string
```

A shipment comes from one port (`incoming_shipments.from_port_id` → `ports.port_id`), and a port is in one country (`ports.port_country_id` → `countries.country_id`). So a shipment has one country through its port.

#### Model Structure

```python
# app/models/incoming_shipment.py
from fastapi_startkit.masoniteorm import Model, HasOneThrough

class IncomingShipment(Model):
    __table__ = "incoming_shipments"
    __primary_key__ = "shipment_id"

    shipment_id: int
    from_port_id: int
    name: str

    from_country = HasOneThrough["Country"](
        ["Country", "Port"],
        "from_port_id",     # FK on IncomingShipment → Port
        "port_country_id",  # FK on Port → Country
        "port_id",          # PK on Port
        "country_id",       # PK on Country
    )
```

```python
# app/models/port.py
from fastapi_startkit.masoniteorm import Model

class Port(Model):
    __table__ = "ports"
    __primary_key__ = "port_id"

    port_id: int
    port_country_id: int
    name: str
```

```python
# app/models/country.py
from fastapi_startkit.masoniteorm import Model

class Country(Model):
    __table__ = "countries"
    __primary_key__ = "country_id"

    country_id: int
    name: str
```

Eager load it and read it like any other relationship:

```python
shipments = await IncomingShipment.with_("from_country").get()
for shipment in shipments:
    print(shipment.from_country.name)
```

## Has Many Through

`HasManyThrough` works the same way, but for many distant models. The arguments mirror `HasOneThrough`, but the keys are read from the intermediate table's side:

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

#### Table Structure

```text
courses
    course_id - integer
    name - string

enrolments
    enrolment_id - integer
    in_course_id - integer
    active_student_id - integer

students
    student_id - integer
    name - string
```

Each enrolment links a course (`enrolments.in_course_id` → `courses.course_id`) to a student (`enrolments.active_student_id` → `students.student_id`). So a course has many students through its enrolments.

#### Model Structure

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
# app/models/enrolment.py
from fastapi_startkit.masoniteorm import Model

class Enrolment(Model):
    __table__ = "enrolments"
    __primary_key__ = "enrolment_id"

    enrolment_id: int
    in_course_id: int
    active_student_id: int
```

```python
# app/models/student.py
from fastapi_startkit.masoniteorm import Model

class Student(Model):
    __table__ = "students"
    __primary_key__ = "student_id"

    student_id: int
    name: str
```

```python
courses = await Course.with_("students").get()
for course in courses:
    print([student.name for student in course.students])
```

## Polymorphic Relationships

A polymorphic relationship lets one model belong to more than one kind of parent through a single pair of columns. For example, an `Image` can belong to a `Post` or a `Video`.

#### Table Structure

```text
posts
    id - integer
    title - string

videos
    id - integer
    title - string

images
    id - integer
    imageable_type - string
    imageable_id - integer
    url - string
```

`images.imageable_type` stores which kind of parent the image belongs to (`"post"` or `"video"`), and `images.imageable_id` stores that parent's id.

#### Model Structure

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

`Post` declares the same `images = MorphMany(...)` attribute. `MorphMany` takes the child model's name. `MorphTo` takes the name of the model it is declared on, and resolves each parent from the morph map. Both are eager loaded with `with_()`:

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
