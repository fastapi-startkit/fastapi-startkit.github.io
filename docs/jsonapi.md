---
outline: deep
title: JSON:API Resources
description: Return JSON:API documents from FastAPI endpoints with JsonResource, including hidden fields, relationships, includes, sparse fieldsets, and pagination meta.
---

# JSON:API Resources

A JSON:API response wraps every model in the same document structure: a `type`, an `id`, an `attributes` object, and optional `relationships`, `included`, `links`, and `meta` keys. A `JsonResource` turns one of your models into that document. It derives the resource type from the class name, serializes the model's attributes, and applies the `include` and sparse fieldset options from the request or from your code. A collection of resources also carries pagination meta.

## Installation

The JSON:API module ships with the core package. Resources serialize [models](/docs/database/models), so install the `database` extra too:

```bash
uv add "fastapi-startkit[fastapi,database]"
```

## Quick Start

To create a resource, extend `JsonResource` with your model:

```python
# app/http/resources/post_resource.py
from fastapi_startkit.jsonapi import JsonResource

from app.models import Post


class PostResource(JsonResource[Post]):
    hidden = ["user_id"]
```

Then return the resource from an endpoint:

```python
# routes/api.py
@app.fastapi.get("/api/posts/{id}")
async def show(id: int):
    post = await Post.find_or_fail(id)
    return PostResource(post)
```

```json
{
  "data": {
    "type": "posts",
    "id": "1",
    "attributes": {
      "id": 1,
      "title": "Hello World",
      "body": "First post body"
    }
  }
}
```

The response has the `application/vnd.api+json` content type. The request's `?include=` and `?fields[type]=` query parameters are applied to it, as described in [Fluent Chain API](#fluent-chain-api).

## Auto-Type Derivation

The `type` is the class name without its `Resource` suffix, passed through `inflection.tableize()`:

| Class name | Derived type |
|---|---|
| `PostResource` | `"posts"` |
| `UserResource` | `"users"` |
| `AgentResource` | `"agents"` |
| `UserProfileResource` | `"user_profiles"` |

To use a different type, set `type` on the class:

```python
class PostResource(JsonResource[Post]):
    type = "articles"
```

## Auto-Serialization

By default, `attributes` holds everything the model's `serialize()` returns. That includes the `id` column and foreign keys such as `user_id`. The top-level `id` is the model's `id`, converted to a string.

### Hiding Sensitive Fields

To keep columns out of `attributes`, list them in `hidden`. Use it for password hashes, tokens, and foreign keys you don't want to expose:

```python
class UserResource(JsonResource[User]):
    hidden = ["password", "remember_token", "company_id"]
```

`hidden` only filters `attributes`, so listing `"id"` removes the duplicate from `attributes` and leaves the top-level `data.id` in place:

```python
class UserResource(JsonResource[User]):
    hidden = ["id", "password"]
```

To build the attributes yourself, override `to_attributes()` and return a dict:

```python
class PostResource(JsonResource[Post]):
    def to_attributes(self):
        return {"title": self.model.title, "excerpt": self.model.body[:100]}
```

## Collections

To return a list of models, call `collection()` instead of creating a single resource:

```python
@app.fastapi.get("/api/posts")
async def index():
    posts = await Post.all()
    return PostResource.collection(posts)
```

```json
{
  "data": [
    { "type": "posts", "id": "1", "attributes": { "id": 1, "title": "Hello World", "body": "First post body" } },
    { "type": "posts", "id": "2", "attributes": { "id": 2, "title": "Second", "body": "More" } }
  ]
}
```

### Paginated Collections

When you pass a paginator, the collection adds pagination meta. [Pagination](/docs/database/models) is a query builder method, so start from `query()`, `where()`, or `with_()`:

```python
@app.fastapi.get("/api/posts")
async def index(page: int = 1):
    posts = await Post.query().paginate(15, page)
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

A paginator from `simple_paginate()` has no `total` or `last_page`, so the meta leaves them out.

## Relationships

To describe a resource's relationships, override `to_relationships()`. It returns a dict, and each value can be a resource class, a lambda, or a resource instance:

```python
# app/http/resources/post_resource.py
class PostResource(JsonResource[Post]):
    hidden = ["user_id"]

    def to_relationships(self):
        return {
            "author": UserResource,
            "comments": lambda: CommentResource.collection(self.model.comments),
        }
```

- A **resource class** wraps the model's attribute of the same name, so `"author"` wraps `self.model.author`. Use it for single related models. When the attribute is `None`, the relationship is left out.
- A **lambda** is called when the document is built. Use it for has-many relationships, by returning a `collection()`.
- A **resource instance**, such as `UserResource(self.model.author)`, is used as it is.

Every relationship appears in `data.relationships` as a type and id, whether or not you include it:

```json
{
  "data": {
    "type": "posts",
    "id": "1",
    "attributes": { "id": 1, "title": "Hello World", "body": "First post body" },
    "relationships": {
      "author": { "data": { "type": "users", "id": "5" } },
      "comments": { "data": [{ "type": "comments", "id": "7" }, { "type": "comments", "id": "8" }] }
    }
  }
}
```

### Eager Loading Relationships

Models don't lazy load relationships, so [eager load](/docs/database/relationships#eager-loading) every relationship the resource declares. That includes the relationships declared by related resources: if `UserResource` declares a `company` relationship, load `author.company` too:

```python
@app.fastapi.get("/api/posts/{id}")
async def show(id: int):
    post = await Post.with_("author", "author.company", "comments").find_or_fail(id)
    return PostResource(post)
```

A relationship that wasn't loaded raises `LazyLoadingViolation` while the response is built, and the request fails with a 500 error.

### Including Related Resources

To add the related resources to the document's `included` array, call `.include()` or send `?include=author` in the request:

```python
return PostResource(post).include("author")
```

```json
{
  "data": {
    "type": "posts",
    "id": "1",
    "attributes": { "id": 1, "title": "Hello World", "body": "First post body" },
    "relationships": {
      "author": { "data": { "type": "users", "id": "5" } },
      "comments": { "data": [{ "type": "comments", "id": "7" }, { "type": "comments", "id": "8" }] }
    }
  },
  "included": [
    {
      "type": "users",
      "id": "5",
      "attributes": { "id": 5, "name": "Alice" },
      "relationships": { "company": { "data": { "type": "companies", "id": "3" } } }
    }
  ]
}
```

For nested relationships, include the parent too: `.include("author", "author.company")`. `"author.company"` on its own includes nothing.

## Fluent Chain API

`.include()` and `.fields()` set the included relationships and the sparse fieldsets in your code. Both return the resource:

```python
return PostResource(post).include("author", "comments").fields("title", "users.name")
```

When you return a resource without calling either method, the request's `?include=` and `?fields[type]=` query parameters are used instead. Once you call one of them, the query string is ignored, so the server decides what the response contains.

Calling `.include()` again replaces the previous list, while `.fields()` adds to it.

Collections have the same methods:

```python
return PostResource.collection(posts).include("author").fields("title", "users.name")
```

To get the document as a dict instead of a response, call `serialize()`:

```python
document = PostResource(post).include("author").serialize()
```

## Sparse Fieldsets

Sparse fieldsets trim the attributes in a response. Pass plain field names for the primary resource, and `"type.field"` to restrict a related resource's attributes:

```python
# Same result as ?include=author&fields[posts]=title&fields[users]=name
return PostResource(post).include("author").fields("title", "users.name")
```

```json
{
  "data": {
    "type": "posts",
    "id": "1",
    "attributes": { "title": "Hello World" },
    "relationships": {
      "author": { "data": { "type": "users", "id": "5" } },
      "comments": { "data": [{ "type": "comments", "id": "7" }, { "type": "comments", "id": "8" }] }
    }
  },
  "included": [
    {
      "type": "users",
      "id": "5",
      "attributes": { "name": "Alice" },
      "relationships": { "company": { "data": { "type": "companies", "id": "3" } } }
    }
  ]
}
```

Fieldsets filter `attributes` only. Relationships are still listed.

## Links, Meta, and Extra Keys

To add top-level `links` and `meta` to a single resource's document, override `to_links()` and `to_meta()`. To merge any other top-level keys, override `with_()`:

```python
# app/http/resources/article_resource.py
class ArticleResource(JsonResource[Article]):
    def to_links(self):
        return {"self": f"/api/articles/{self.model.id}"}

    def to_meta(self):
        return {"words": len(self.model.body.split())}

    def with_(self):
        return {"jsonapi": {"version": "1.1"}}
```

```json
{
  "data": { "type": "articles", "id": "1", "attributes": { ... } },
  "links": { "self": "/api/articles/1" },
  "meta": { "words": 3 },
  "jsonapi": { "version": "1.1" }
}
```

`with_()` is merged last, so a `links` or `meta` key it returns replaces the one from `to_links()` or `to_meta()`. These hooks apply to single resources only: a collection's document doesn't call them, and its `meta` holds only the pagination meta.

## Returning a Different Status Code

A resource returned from an endpoint always responds with status 200. To send another status, such as 201 after creating a model, wrap the serialized document in a `JSONResponse`:

```python
# routes/api.py
from fastapi.responses import JSONResponse
from fastapi_startkit.validation import Validated

from app.http.requests import StorePost


@app.fastapi.post("/api/posts")
async def store(data: Validated[StorePost]):
    created = await Post.create(data.model_dump())
    post = await Post.with_("author", "author.company", "comments").find_or_fail(created.id)
    return JSONResponse(
        PostResource(post).serialize(),
        status_code=201,
        media_type="application/vnd.api+json",
    )
```

A model returned by `create()` has no relationships loaded, so the example fetches it again with `with_()` before serializing it. `serialize()` doesn't read the query string, so use the chain methods to include relationships or restrict fields.

## Overridable Hooks

These are the methods you can override on a `JsonResource`:

| Method | Returns |
|---|---|
| `to_attributes()` | A `{name: value}` dict for `attributes`. |
| `to_relationships()` | A dict of relationship names to a resource class, a lambda, or a resource instance. |
| `to_links()` | The top-level `links` dict, or `None`. |
| `to_meta()` | The top-level `meta` dict, or `None`. |
| `with_()` | Extra top-level keys, merged last. |

## Query-Param Helpers

To read the `include` and `fields` query parameters yourself, use `parse_include` and `parse_fields`:

```python
from fastapi import Request
from fastapi_startkit.jsonapi import parse_fields, parse_include


@app.fastapi.get("/api/posts/{id}")
async def show(id: int, request: Request):
    include = parse_include(request.query_params.get("include"))
    # ?include=author,comments -> ["author", "comments"]

    fields = parse_fields(dict(request.query_params))
    # ?fields[posts]=title,body&fields[users]=name -> {"posts": ["title", "body"], "users": ["name"]}
    ...
```

## Full Example

```python
# app/http/resources.py
from fastapi_startkit.jsonapi import JsonResource

from app.models import Comment, Company, Post, User


class CompanyResource(JsonResource[Company]):
    pass


class UserResource(JsonResource[User]):
    hidden = ["password", "company_id"]

    def to_relationships(self):
        return {"company": CompanyResource}


class CommentResource(JsonResource[Comment]):
    hidden = ["post_id"]


class PostResource(JsonResource[Post]):
    hidden = ["user_id"]

    def to_relationships(self):
        return {
            "author": UserResource,
            "comments": lambda: CommentResource.collection(self.model.comments),
        }
```

```python
# routes/api.py
from app.http.resources import PostResource
from app.models import Post


@app.fastapi.get("/api/posts/{id}")
async def show(id: int):
    post = await Post.with_("author", "author.company", "comments").find_or_fail(id)
    return PostResource(post)


@app.fastapi.get("/api/posts/{id}/summary")
async def summary(id: int):
    post = await Post.with_("author", "author.company", "comments").find_or_fail(id)
    return PostResource(post).include("author").fields("title", "users.name")


@app.fastapi.get("/api/posts")
async def index(page: int = 1):
    posts = await Post.with_("author", "author.company", "comments").paginate(15, page)
    return PostResource.collection(posts).include("author").fields("title", "users.name")
```

`GET /api/posts/1?include=author,author.company,comments` returns the post with its author, the author's company, and the comments in `included`.
