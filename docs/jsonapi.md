---
title: JSON:API Resources
description: Build JSON:API-compliant responses with JsonResource — automatic serialization, hidden fields, pagination meta, and collection wrappers.
---

# JSON:API Resources

FastAPI Startkit ships a first-class **JSON:API** layer built around the `JsonResource` generic base class. It handles type derivation, auto-serialization, hidden fields, relationship side-loading, sparse fieldsets, and paginator meta — all with zero boilerplate.

## Installation

The JSON:API module requires no extra dependencies beyond the core package.

```bash
pip install fastapi-startkit
```

## Quick Start

```python
from fastapi_startkit.jsonapi import JsonResource

class PostResource(JsonResource["Post"]):
    pass  # type="posts", attributes from Post.serialize() automatically
```

Return the resource directly from a FastAPI endpoint:

```python
@app.get("/api/posts/{id}")
async def get_post(id: int):
    post = await Post.find_or_fail(id)
    return PostResource(post)
```

JSON:API envelope returned automatically:

```json
{
  "data": {
    "type": "posts",
    "id": "1",
    "attributes": {
      "title": "Hello World",
      "body": "..."
    }
  }
}
```

## Auto-Type Derivation

The `type` field is derived from the class name via `inflection.tableize()` — no need to set it manually.

| Class name | Derived type |
|---|---|
| `PostResource` | `"posts"` |
| `UserResource` | `"users"` |
| `AgentResource` | `"agents"` |
| `UserProfileResource` | `"user_profiles"` |

Override `type` to use a custom value:

```python
class PostResource(JsonResource[Post]):
    type = "articles"  # explicit override
```

## Auto-Serialization

By default, `to_attributes()` calls `model.serialize()` and strips `"id"` from the result. This means your ORM model's fields are exposed automatically with no extra configuration.

```python
class PostResource(JsonResource[Post]):
    pass  # all model fields except 'id' are included
```

### Hiding Sensitive Fields

Use the `hidden` class variable to blacklist fields:

```python
class UserResource(JsonResource[User]):
    hidden = ["password", "remember_token", "api_key"]
```

Both `"id"` and every field in `hidden` are excluded from `data.attributes`.

### Explicit Attribute Lists (Old Style)

You can still list attributes explicitly — useful when you want fine-grained control or need to rename fields:

```python
class UserResource(JsonResource[User]):
    attributes = ["name", "email"]  # explicit list takes priority over auto-serialize

    def to_attributes(self):
        return {
            "full_name": self.model.name,
            "email": self.model.email,
        }
```

When `attributes` is non-empty, `to_attributes()` reads those named instance attributes instead of calling `model.serialize()`.

## Collections

Use `JsonResource.collection()` to wrap any iterable of models:

```python
@app.get("/api/posts")
async def list_posts():
    posts = await Post.all()
    return PostResource.collection(posts)
```

The response is a JSON:API collection:

```json
{
  "data": [
    { "type": "posts", "id": "1", "attributes": { "title": "Hello" } },
    { "type": "posts", "id": "2", "attributes": { "title": "World" } }
  ]
}
```

### Paginated Collections

Pass a `LengthAwarePaginator` or `SimplePaginator` directly — pagination meta is added automatically:

```python
@app.get("/api/posts")
async def list_posts(page: int = 1):
    posts = await Post.paginate(15, page)       # LengthAwarePaginator
    return PostResource.collection(posts)
```

Response with pagination meta:

```json
{
  "data": [...],
  "meta": {
    "total": 42,
    "per_page": 15,
    "current_page": 1,
    "last_page": 3,
    "next_page": 2,
    "previous_page": null
  }
}
```

`SimplePaginator` (cursor-style) produces the same structure without `total` and `last_page`.

## Extra Envelope Keys — `with_()`

Override `with_()` to merge extra top-level keys into the JSON:API document:

```python
class ArticleResource(JsonResource[Article]):
    def with_(self):
        return {
            "meta": {"version": "1.1"},
            "jsonapi": {"version": "1.0"},
        }
```

`with_()` is applied **after** `to_links()` / `to_meta()`, so its keys take precedence.

## Relationships

Override `to_relationships()` to declare related resources:

```python
class PostResource(JsonResource[Post]):
    def to_relationships(self):
        if not self.model.author:
            return None
        return {"author": UserResource(self.model.author)}
```

Side-load relationships with `?include=author`:

```python
@app.get("/api/posts/{id}")
async def get_post(id: int, include: str | None = Query(None)):
    post = await Post.find_or_fail(id)
    return PostResource(post).serialize(include=parse_include(include))
```

Response:

```json
{
  "data": {
    "type": "posts",
    "id": "1",
    "attributes": { "title": "Hello" },
    "relationships": {
      "author": { "data": { "type": "users", "id": "5" } }
    }
  },
  "included": [
    { "type": "users", "id": "5", "attributes": { "name": "Alice" } }
  ]
}
```

Nested dot-notation is supported: `?include=author.company`.

## Sparse Fieldsets

Restrict which attributes are returned with `fields[type]=field1,field2`:

```python
from fastapi_startkit.jsonapi import parse_fields

@app.get("/api/posts/{id}")
async def get_post(id: int, request: Request):
    post = await Post.find_or_fail(id)
    fields = parse_fields(dict(request.query_params))
    return PostResource(post).serialize(fields=fields)
```

`GET /api/posts/1?fields[posts]=title` returns only `title` in `data.attributes`.

## Overridable Hooks

All hooks are optional overrides:

| Method | Purpose |
|---|---|
| `to_attributes()` | Returns `{name: value}` dict of resource attributes |
| `to_relationships()` | Returns `{name: JsonResource}` dict of related resources |
| `to_links()` | Returns top-level `links` dict |
| `to_meta()` | Returns top-level `meta` dict |
| `with_()` | Returns extra top-level keys merged into the envelope |

## Backward Compatibility

`JsonAPIResponse` and `JsonAPIListResponse` remain available as aliases:

```python
from fastapi_startkit.jsonapi import JsonAPIResponse, JsonAPIListResponse

class UserResource(JsonAPIResponse):
    type = "users"
    attributes = ["name", "email"]

    def __init__(self, id_, name, email):
        self.id = id_
        self.name = name
        self.email = email

    def to_attributes(self):
        return {"name": self.name, "email": self.email}

users = await User.all()
return JsonAPIListResponse([UserResource(u.id, u.name, u.email) for u in users])
```

Old-style subclasses continue to work unchanged.

## Query-Param Helpers

```python
from fastapi_startkit.jsonapi import parse_include, parse_fields

# ?include=author,comments  ->  ["author", "comments"]
include = parse_include(request.query_params.get("include"))

# ?fields[posts]=title,body&fields[users]=name  ->  {"posts": ["title", "body"], "users": ["name"]}
fields = parse_fields(dict(request.query_params))
```

## Full Example

```python
from fastapi import Depends, Query, Request
from fastapi_startkit.jsonapi import JsonResource, parse_fields, parse_include

class PostResource(JsonResource[Post]):
    hidden = ["internal_notes"]

    def to_relationships(self):
        author = getattr(self.model, "author", None)
        if author is None:
            return None
        return {"author": UserResource(author)}

    def with_(self):
        return {"jsonapi": {"version": "1.0"}}


class UserResource(JsonResource[User]):
    hidden = ["password"]


@app.get("/api/posts/{id}")
async def get_post(
    id: int,
    request: Request,
    include: str | None = Query(None),
):
    post = await Post.find_or_fail(id)
    return PostResource(post).serialize(
        include=parse_include(include),
        fields=parse_fields(dict(request.query_params)),
    )


@app.get("/api/posts")
async def list_posts(page: int = 1):
    posts = await Post.paginate(15, page)
    return PostResource.collection(posts)
```
