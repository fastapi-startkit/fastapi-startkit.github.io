---
outline: deep
title: Relationships
---

# Relationships

Relationships are declared as class-level attributes on your model using the relationship descriptors from `fastapi_startkit.masoniteorm.relationships`. Type hints wrapped in `TYPE_CHECKING` keep imports lazy and prevent circular-import issues.

```python
from typing import TYPE_CHECKING
from fastapi_startkit.masoniteorm.relationships import BelongsTo, HasMany, BelongsToMany

if TYPE_CHECKING:
    from app.models.user import User
```

## BelongsTo

Use `BelongsTo` when the current model holds the foreign key — a "child" pointing to its "parent".

**Signature:**
```python
BelongsTo(related_model, local_key, foreign_key)
```

| Parameter | Description |
|---|---|
| `related_model` | String name of the related model class |
| `local_key` | Foreign key column on **this** model |
| `foreign_key` | Primary key column on the **related** model |

**Example — `Media` belongs to `Post`:**

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

**Example — `Post` belongs to `User` with explicit key names:**

```python
author: "User" = BelongsTo('User', local_key='user_id', foreign_key="id")
```

## HasMany

Use `HasMany` when the related model holds a foreign key pointing back to this model — a "parent" owning many "children".

**Signature:**
```python
HasMany(related_model)
```

**Example — `User` has many `Post`s:**

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

**Example — `Post` has many `Media` items:**

```python
media: list["Media"] = HasMany("Media")
```

## BelongsToMany

Use `BelongsToMany` for many-to-many relationships where a pivot table connects two models.

**Signature:**
```python
BelongsToMany(related_model, local_foreign_key, related_foreign_key, table)
```

| Parameter | Description |
|---|---|
| `related_model` | String name of the related model class |
| `local_foreign_key` | Column in the pivot table that references **this** model |
| `related_foreign_key` | Column in the pivot table that references the **related** model |
| `table` | Name of the pivot table |

**Example — `Post` belongs to many `Tag`s:**

```python
# app/models/post.py
tags: list["Tag"] = BelongsToMany("Tag", "post_id", "tag_id", table="post_tag")
```

**Example — `Tag` belongs to many `Post`s (inverse side):**

```python
# app/models/tag.py
posts: list["Post"] = BelongsToMany("Post")
```

### Pivot Model

Define a simple model for the pivot table when you need to insert or query pivot records directly:

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

Attaching tags to a post:

```python
await PostTag.first_or_create({"post_id": post.id, "tag_id": tag.id})
```

## HasOneThrough

Use `HasOneThrough` when a model reaches a **distant** model through an **intermediary** model — one result per owner.

**Schema structure:**

```
IncomingShipment → (via from_port_id) → Port → (via port_country_id) → Country
```

**Signature (decorator form):**

```python
@HasOneThrough(None, local_key, intermediary_fk, intermediary_pk, distant_pk)
def relationship_name(self):
    return [DistantModel, IntermediaryModel]
```

| Parameter | Description |
|---|---|
| `None` | Always `None` — the decorated method provides the model pair |
| `local_key` | FK on **this** model that references the intermediary table |
| `intermediary_fk` | FK on the **intermediary** model that references the distant table |
| `intermediary_pk` | PK on the **intermediary** model |
| `distant_pk` | PK on the **distant** model |

**Example — `IncomingShipment` has one `Country` through `Port`:**

```python
# app/models/incoming_shipment.py
from fastapi_startkit.masoniteorm import Model
from fastapi_startkit.masoniteorm.relationships import HasOneThrough
from app.models.country import Country
from app.models.port import Port

class IncomingShipment(Model):
    __table__ = "incoming_shipments"

    shipment_id: int
    name: str
    from_port_id: int

    @HasOneThrough(None, "from_port_id", "port_country_id", "port_id", "country_id")
    def from_country(self):
        return [Country, Port]
```

**Lazy access:**

```python
shipment = await IncomingShipment.where("name", "Milk").first()
country = shipment.from_country   # Country instance
print(country.name)               # "Australia"
```

**Eager loading:**

```python
shipments = await IncomingShipment.where("name", "Bread").with_("from_country").get()
for shipment in shipments:
    print(shipment.from_country.name)
```

**Filtering with `where_has`:**

```python
# Only shipments from a port in the USA
shipments = await IncomingShipment.where_has(
    "from_country", lambda q: q.where("name", "USA")
).get()
```

## HasManyThrough

Use `HasManyThrough` when a model reaches **many** distant models through an **intermediary** model — a collection per owner.

**Schema structure:**

```
Course → (via in_course_id on Enrolment) → Enrolment → (via active_student_id) → Student
```

**Signature (class-attribute form):**

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
| `["DistantModel", "IntermediaryModel"]` | String names of the distant and intermediary models |
| `local_foreign_key` | FK on the **intermediary** that references **this** model |
| `other_foreign_key` | FK on the **intermediary** that references the **distant** model |
| `local_owner_key` | PK on **this** model |
| `other_owner_key` | PK on the **distant** model |

**Example — `Course` has many `Student`s through `Enrolment`:**

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

**Lazy access:**

```python
course = await Course.where("name", "Math 101").first()
students = await course.students   # Collection of Student instances
print(students.count())
```

**Eager loading:**

```python
courses = await Course.with_("students").get()
for course in courses:
    students = await course.students
    print([s.name for s in students])
```

**Filtering with `where_has`:**

```python
# Only courses that have a student named "Bob"
courses = await Course.where_has(
    "students", lambda q: q.where("name", "Bob")
).get()
```

## Eager Loading

Load relationships alongside the main query to avoid N+1 queries. Pass relationship names as strings to `with_()`:

```python
# Load posts with their author and tags in a single query set
posts = await Post.with_("author", "tags").get()

for post in posts:
    print(post.author.name)
    print([tag.name for tag in post.tags])
```

You can combine as many relationships as needed:

```python
posts = await Post.with_("author", "tags", "media").get()
```

## Full Model Reference

Here is the complete `Post` model showing all three relationship types together:

```python
# app/models/post.py
from typing import TYPE_CHECKING
from fastapi_startkit.masoniteorm import Model
from fastapi_startkit.masoniteorm.relationships import BelongsTo, HasMany, BelongsToMany, HasOneThrough, HasManyThrough

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