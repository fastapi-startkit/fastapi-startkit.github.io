---
outline: deep
title: Relationships
description: Define and manage database relationships (One-to-One, One-to-Many, Many-to-Many) using the FastAPI Startkit ORM.
keywords: orm, relationships, database, foreign keys, fastapi
---

# Relationships

Database tables are rarely islands. A post has an author, a user writes many posts, and a post can carry many tags. Relationships let you describe those connections once, on the model, and then load related records without writing joins by hand.

You declare a relationship as a class attribute on the model, using the classes in `fastapi_startkit.masoniteorm.relationships`. Import related models under `TYPE_CHECKING` so the type hints don't cause circular imports:

```python
from typing import TYPE_CHECKING
from fastapi_startkit.masoniteorm.relationships import BelongsTo, HasMany, BelongsToMany

if TYPE_CHECKING:
    from app.models.user import User
```

## BelongsTo

Use `BelongsTo` when this model holds the foreign key, such as a post pointing at its author. Its signature looks like this:

```python
BelongsTo(related_model, local_key, foreign_key)
```

| Parameter | Description |
|---|---|
| `related_model` | String name of the related model class |
| `local_key` | Foreign key column on this model |
| `foreign_key` | Primary key column on the related model |

For example, `Media` belongs to `Post`:

```python
# app/models/media.py
from typing import TYPE_CHECKING
from fastapi_startkit.masoniteorm import Model
from fastapi_startkit.masoniteorm.relationships import BelongsTo

if TYPE_CHECKING:
    from app.models.post import Post

class Media(Model):
    __table__ = "media"

    id: int
    post_id: int
    url: str

    post: "Post" = BelongsTo("Post")
```

When the column names don't follow the defaults, pass the keys explicitly. Here `Post` belongs to `User`:

```python
author: "User" = BelongsTo('User', local_key='user_id', foreign_key="id")
```

## HasMany

`HasMany` is the other side of that connection. Use it when the related model holds a foreign key back to this one, such as a user with many posts:

```python
HasMany(related_model)
```

Here, a `User` has many `Post`s:

```python
# app/models/user.py
from typing import TYPE_CHECKING
from fastapi_startkit.masoniteorm import Model
from fastapi_startkit.masoniteorm.relationships import HasMany

if TYPE_CHECKING:
    from app.models.post import Post

class User(Model):
    __table__ = "users"

    id: int
    name: str
    email: str

    posts: list["Post"] = HasMany("Post")
```

In the same way, a `Post` has many `Media` items:

```python
media: list["Media"] = HasMany("Media")
```

## BelongsToMany

Some relationships run both ways. A post can have many tags, and a tag can belong to many posts. Use `BelongsToMany` when a pivot table links two models like this:

```python
BelongsToMany(related_model, local_foreign_key, related_foreign_key, table=pivot_table)
```

| Parameter | Description |
|---|---|
| `related_model` | String name of the related model class |
| `local_foreign_key` | Pivot column that references this model |
| `related_foreign_key` | Pivot column that references the related model |
| `table` | Name of the pivot table. Pass it as a keyword argument. |

So a `Post` belongs to many `Tag`s:

```python
# app/models/post.py
tags: list["Tag"] = BelongsToMany("Tag", "post_id", "tag_id", table="post_tag")
```

And the inverse, where a `Tag` belongs to many `Post`s:

```python
# app/models/tag.py
posts: list["Post"] = BelongsToMany("Post")
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

Then attaching a tag to a post is a single call:

```python
await PostTag.first_or_create({"post_id": post.id, "tag_id": tag.id})
```

## HasOneThrough

Use `HasOneThrough` when a model reaches one distant model through an intermediate model. Consider this schema:

```
IncomingShipment → (via from_port_id) → Port → (via port_country_id) → Country
```

The signature takes the two model names, followed by the keys that connect them:

```python
relationship_name: "DistantModel" = HasOneThrough(
    ["DistantModel", "IntermediaryModel"],
    local_key,
    intermediary_fk,
    intermediary_pk,
    distant_pk,
)
```

| Parameter | Description |
|---|---|
| `["DistantModel", "IntermediaryModel"]` | String names of the distant and intermediate models |
| `local_key` | Foreign key on this model that references the intermediate table |
| `intermediary_fk` | Foreign key on the intermediate model that references the distant table |
| `intermediary_pk` | Primary key on the intermediate model |
| `distant_pk` | Primary key on the distant model |

Putting it together, an `IncomingShipment` has one `Country` through `Port`:

```python
# app/models/incoming_shipment.py
from typing import TYPE_CHECKING
from fastapi_startkit.masoniteorm import Model
from fastapi_startkit.masoniteorm.relationships import HasOneThrough

if TYPE_CHECKING:
    from app.models.country import Country

class IncomingShipment(Model):
    __table__ = "incoming_shipments"

    shipment_id: int
    name: str
    from_port_id: int

    from_country: "Country" = HasOneThrough(
        ["Country", "Port"],
        "from_port_id",     # FK on IncomingShipment → Port
        "port_country_id",  # FK on Port → Country
        "port_id",          # PK on Port
        "country_id",       # PK on Country
    )
```

If a relationship wasn't eager loaded, accessing it runs a query, so you need to await it:

```python
shipment = await IncomingShipment.where("name", "Milk").first()
country = await shipment.from_country
print(country.name)               # "Australia"
```

After `with_()`, on the other hand, the attribute already holds the loaded model:

```python
shipments = await IncomingShipment.where("name", "Bread").with_("from_country").get()
for shipment in shipments:
    print(shipment.from_country.name)
```

You can also filter on the relationship with `where_has`:

```python
# Only shipments from a port in the USA
shipments = await IncomingShipment.where_has(
    "from_country", lambda q: q.where("name", "USA")
).get()
```

## HasManyThrough

`HasManyThrough` works the same way, but for many distant models. Use it when a model reaches many distant models through an intermediate model, as in this schema:

```
Course → (via in_course_id on Enrolment) → Enrolment → (via active_student_id) → Student
```

The signature mirrors `HasOneThrough`:

```python
relationship_name: list["DistantModel"] = HasManyThrough(
    ["DistantModel", "IntermediaryModel"],
    local_foreign_key,
    other_foreign_key,
    local_owner_key,
    other_owner_key,
)
```

| Parameter | Description |
|---|---|
| `["DistantModel", "IntermediaryModel"]` | String names of the distant and intermediate models |
| `local_foreign_key` | Foreign key on the intermediate model that references this model |
| `other_foreign_key` | Foreign key on the intermediate model that references the distant model |
| `local_owner_key` | Primary key on this model |
| `other_owner_key` | Primary key on the distant model |

Here, a `Course` has many `Student`s through `Enrolment`:

```python
# app/models/course.py
from typing import TYPE_CHECKING
from fastapi_startkit.masoniteorm import Model
from fastapi_startkit.masoniteorm.relationships import HasManyThrough

if TYPE_CHECKING:
    from app.models.student import Student

class Course(Model):
    __table__ = "course"

    course_id: int
    name: str

    students: list["Student"] = HasManyThrough(
        ["Student", "Enrolment"],
        "in_course_id",      # FK on Enrolment → Course
        "active_student_id", # FK on Enrolment → Student
        "course_id",         # PK on Course
        "student_id",        # PK on Student
    )
```

Accessing the relationship lazily runs a query:

```python
course = await Course.where("name", "Math 101").first()
students = await course.students   # Collection of Student instances
print(students.count())
```

When you eager load it, the collection is already on the model, so don't await it:

```python
courses = await Course.with_("students").get()
for course in courses:
    print([s.name for s in course.students])
```

Filtering with `where_has` works here too:

```python
# Only courses that have a student named "Bob"
courses = await Course.where_has(
    "students", lambda q: q.where("name", "Bob")
).get()
```

## Eager Loading

Lazy loading is convenient, but accessing a relationship inside a loop runs one query per row. This is known as the N+1 problem, and it can quietly slow a page down. To avoid it, pass relationship names to `with_()` to load them up front:

```python
posts = await Post.with_("author", "tags").get()

for post in posts:
    print(post.author.name)
    print([tag.name for tag in post.tags])
```

You can pass as many names as you need:

```python
posts = await Post.with_("author", "tags", "media").get()
```

## Full Model Reference

For reference, here's the complete `Post` model with `BelongsTo`, `HasMany`, and `BelongsToMany`:

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
