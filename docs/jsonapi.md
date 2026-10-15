---
outline: deep
title: JSON:API Resources
description: Return JSON:API documents from FastAPI endpoints with JsonResource, including hidden fields, includes, sparse fieldsets, and pagination meta.
---

# JSON:API Resources

`JsonResource` turns a model into a JSON:API document. It derives the resource type from the class name, serializes the model's attributes, and handles `include`, sparse fieldsets, and pagination meta.

## Installation

The JSON:API module needs nothing beyond the core package:

```bash
uv add fastapi-startkit
```

## Quick Start

```python
from fastapi_startkit.jsonapi import JsonResource

class PostResource(JsonResource["Post"]):
    pass  # type="posts", attributes from Post.serialize() automatically
```

Return the resource from an endpoint. The `?include=` and `?fields[*]=` query parameters are applied for you:

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

Use `.include()` and `.fields()` to choose what is serialized. `.fields()` takes plain names for the primary resource and `"type.field"` for related resources:

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

If you return a resource without calling these methods, the `?include=` and `?fields[*]=` query parameters from the request are used instead. Both produce the same result: the chain fixes the output on the server, and the query string lets the client choose.

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

`to_attributes()` returns everything from `model.serialize()` except the fields listed in `hidden`:

```python
class PostResource(JsonResource[Post]):
    pass  # all model fields are included in data.attributes
```

### Hiding Sensitive Fields

```python
class UserResource(JsonResource[User]):
    hidden = ["password", "remember_token", "api_key"]
```

`hidden` only filters `attributes`; the top-level `data.id` is always present. To keep `id` out of `attributes`, list it:

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

Pass a `LengthAwarePaginator` or `SimplePaginator` and the pagination meta is added. A `SimplePaginator` has no `total` or `last_page`:

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
    "count": 15,
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

`to_relationships()` returns a dict. Each value is a resource class, a lambda, or a resource instance:

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

For nested relationships, include the parent too: `.include("author", "author.company")`. `"author.company"` on its own includes nothing.

## Sparse Fieldsets

Pass plain field names for the primary resource, and `"type.field"` to restrict a related resource's attributes:

```python
# GET /api/posts?fields[posts]=title,created_at&fields[users]=name&include=author
return PostResource(post).include("author").fields("title", "created_at", "users.name")
```

Without chain methods, `?fields[posts]=title,created_at` in the URL does the same.

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
