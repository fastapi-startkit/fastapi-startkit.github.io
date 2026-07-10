---
outline: deep
title: JSON:API Resources
description: Build JSON:API-compliant responses with JsonResource — automatic serialization, hidden fields, pagination meta, fluent chain API for fields and includes.
---

# JSON:API Resources

FastAPI Startkit ships a first-class **JSON:API** layer built around the `JsonResource` generic base class. It handles type derivation, auto-serialization, hidden fields, relationship side-loading, sparse fieldsets, and paginator meta — all with zero boilerplate.

## Installation

The JSON:API module requires no extra dependencies beyond the core package.

```bash
uv add fastapi-startkit
```

## Quick Start

```python
from fastapi_startkit.jsonapi import JsonResource

class PostResource(JsonResource["Post"]):
    pass  # type="posts", attributes from Post.serialize() automatically
```

Return the resource directly from a FastAPI endpoint — `?include=` and `?fields[*]=` query params are parsed and applied automatically:

```python
@app.get("/api/posts/{id}")
async def get_post(id: int):
    post = await Post.find_or_fail(id)
    return PostResource(post)
```

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

## Fluent Chain API

Use `.include()` and `.fields()` to control what gets serialized.

`.fields()` takes plain field names for the primary resource, and `"type.field"` dotted specs for related resources:

```python
# Sideload a relationship
return PostResource(post).include("author")

# Sparse fieldsets — plain names restrict this resource's attributes
return PostResource(post).fields("title", "created_at")

# Dotted names restrict a related type's attributes
# mirrors ?fields[posts]=title,created_at&fields[users]=name&include=author
return (
    PostResource(post)
    .include("author")
    .fields("title", "created_at", "users.name")
)

# Manual serialization to a dict
doc = PostResource(post).include("author").fields("title", "users.name").serialize()
```

The same chain API works on collections:

```python
return PostResource.collection(posts).include("author").fields("title", "users.name")
```

When the resource is returned directly from a FastAPI endpoint **without** calling chain methods, `?include=` and `?fields[*]=` query params are parsed from the live request automatically. The chain API and automatic query-string parsing are equivalent — use whichever fits your endpoint.

## Auto-Type Derivation

The `type` field is derived from the class name via `inflection.tableize()`:

| Class name | Derived type |
|---|---|
| `PostResource` | `"posts"` |
| `UserResource` | `"users"` |
| `AgentResource` | `"agents"` |
| `UserProfileResource` | `"user_profiles"` |

Override `type` to use a custom value:

```python
class PostResource(JsonResource[Post]):
    type = "articles"
```

## Auto-Serialization

`to_attributes()` calls `model.serialize()` and exposes all returned fields. Only fields listed in `hidden` are excluded.

```python
class PostResource(JsonResource[Post]):
    pass  # all model fields are included in data.attributes
```

### Hiding Sensitive Fields

```python
class UserResource(JsonResource[User]):
    hidden = ["password", "remember_token", "api_key"]
```

To also hide `id`, add it explicitly:

```python
class UserResource(JsonResource[User]):
    hidden = ["id", "password"]
```

## Collections

```python
@app.get("/api/posts")
async def list_posts():
    posts = await Post.all()
    return PostResource.collection(posts)
```

```json
{
  "data": [
    { "type": "posts", "id": "1", "attributes": { "title": "Hello" } },
    { "type": "posts", "id": "2", "attributes": { "title": "World" } }
  ]
}
```

### Paginated Collections

Pass a `LengthAwarePaginator` or `SimplePaginator` — pagination meta is added automatically:

```python
@app.get("/api/posts")
async def list_posts(page: int = 1):
    posts = await Post.paginate(15, page)
    return PostResource.collection(posts)
```

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

## Extra Envelope Keys — `with_()`

Override `with_()` to merge extra top-level keys into the document:

```python
class ArticleResource(JsonResource[Article]):
    def with_(self):
        return {
            "jsonapi": {"version": "1.0"},
            "meta": {"generated_at": "2026-01-01"},
        }
```

`with_()` is applied last, so its keys take precedence over `to_links()` / `to_meta()`.

## Relationships

`to_relationships()` returns a plain dict with two intended forms:

```python
class PostResource(JsonResource[Post]):
    def to_relationships(self):
        return {
            # Class reference → always a single resource.
            # Framework reads self.model.author and wraps it with UserResource.
            # Omitted automatically when model.author is None.
            "author": UserResource,

            # Lambda → for has-many / collections and any custom logic.
            # Call ResourceClass.collection() inside the lambda.
            "comments": lambda: CommentResource.collection(self.model.comments),

            # Explicit instance — full control when needed.
            "tag": TagResource(self.model.primary_tag),
        }
```

The key name drives the lookup for the class-reference form (`"author"` → `self.model.author`).

Sideload with `.include()`:

```python
return PostResource(post).include("author")
```

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

Nested dot-notation is supported: `.include("author.company")`.

## Sparse Fieldsets

Pass plain field names for the primary resource, and `"type.field"` to restrict a related resource's attributes:

```python
# GET /api/posts?fields[posts]=title,created_at&fields[users]=name&include=author
return PostResource(post).include("author").fields("title", "created_at", "users.name")
```

When returning resources directly (without chain methods), `?fields[posts]=title,created_at` in the URL is applied automatically.

## Overridable Hooks

| Method | Purpose |
|---|---|
| `to_attributes()` | `{name: value}` dict of resource attributes |
| `to_relationships()` | `{name: JsonResource}` dict of related resources |
| `to_links()` | Top-level `links` dict |
| `to_meta()` | Top-level `meta` dict |
| `with_()` | Extra top-level envelope keys merged last |

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
from fastapi import Query, Request
from fastapi_startkit.jsonapi import JsonResource

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


# Automatic query-string parsing — client controls fields and includes
@app.get("/api/posts/{id}")
async def get_post(id: int):
    post = await Post.find_or_fail(id)
    return PostResource(post)


# Server-controlled restrictions via chain API
@app.get("/api/posts/{id}/summary")
async def get_post_summary(id: int):
    post = await Post.find_or_fail(id)
    return PostResource(post).fields("title", "created_at")


# Paginated collection with include + field restriction
@app.get("/api/posts")
async def list_posts(page: int = 1):
    posts = await Post.paginate(15, page)
    return PostResource.collection(posts).include("author").fields("title", "users.name")
```
