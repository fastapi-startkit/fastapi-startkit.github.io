---
outline: deep
title: Validation
description: Validate request bodies and query strings with form requests — chainable field rules, custom messages, async and database rules, after() hooks, and Laravel-style 422 responses.
keywords: validation, form request, fastapi validation, validation rules, custom validation rule, unique rule, exists rule, 422, validated, fastapi startkit
---

# Validation

Pydantic already checks that the data your API receives has the right types. Most apps need more than that: a title has to be present, a password needs at least 8 characters, an email can't already be taken. FastAPI Startkit's validation is modelled on Laravel's form requests. You declare a `FormRequest` with rules on its fields, take it as a `Validated[...]` parameter in your endpoint, and the framework validates the request before your code runs. Rules can be async, so a rule that queries the database works just like one that checks a string's length.

## Installation

Validation ships with the core package. To use `Validated` in endpoints, install the `fastapi` extra and register `FastAPIProvider`:

```bash
uv add "fastapi-startkit[fastapi]"
```

```python
# bootstrap/application.py
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

app = Application(
    base_path=...,
    providers=[
        FastAPIProvider,
        # ... other providers
    ],
)
```

`FastAPIProvider` registers the handler that turns validation failures into [422 responses](#error-responses). Without it, a failed validation surfaces as an unhandled exception. The [`unique` and `exists`](#database-rules) rules also need a configured database connection; see [Database](/docs/database/).

## Quickstart

### Defining the Form Request

A form request is a Pydantic model that extends `FormRequest`. You attach rules to a field by annotating it with a `Field()` and chaining rule methods:

```python
# app/http/requests/store_post.py
from typing import Annotated

from fastapi_startkit.validation import Field, FormRequest


class StorePost(FormRequest):
    title: Annotated[str, Field().required().string().max(255)]
    body: Annotated[str, Field().required().min(10)]
    status: Annotated[str, Field().in_(["draft", "published"])] = "draft"
```

`Field` here is `fastapi_startkit.validation.Field`, not Pydantic's `Field`. If you need both in one file, import Pydantic's under another name, such as `from pydantic import Field as PydanticField`.

### Using It in a Route

Add a parameter typed as `Validated[StorePost]`. By the time your endpoint runs, the input has passed every rule, and the parameter holds a `StorePost` instance:

```python
# routes/api.py
from fastapi_startkit.validation import Validated

from app.http.requests.store_post import StorePost


@app.fastapi.post("/posts")
async def store(data: Validated[StorePost]):
    return {"title": data.title, "status": data.status}
```

```bash
curl -X POST http://localhost:8000/posts \
  -H 'Content-Type: application/json' \
  -d '{"title": "Hello", "body": "A long enough body"}'
# {"title":"Hello","status":"draft"}
```

If validation fails, your endpoint isn't called. A JSON client gets a 422 response that lists the first failing message for each field:

```bash
curl -X POST http://localhost:8000/posts \
  -H 'Content-Type: application/json' \
  -d '{"title": "", "body": "short", "status": "archived"}'
```

```json
{
  "message": "The title field is required. (and 2 more errors)",
  "errors": {
    "title": ["The title field is required."],
    "body": ["The body field must be at least 10 characters."],
    "status": ["The selected status is invalid."]
  }
}
```

### Validating Query Strings

For `GET`, `HEAD`, `OPTIONS` and `DELETE` routes, `Validated` reads the query string. Values are coerced to the field types, and a repeated key becomes a list when the field is a list, tuple, set or other sequence:

```python
from typing import Annotated

from fastapi_startkit.validation import Field, FormRequest, Validated


class ListPosts(FormRequest):
    q: Annotated[str, Field().string().max(50)] = ""
    page: Annotated[int, Field().integer().min(1)] = 1
    tags: list[str] = []


@app.fastapi.get("/posts")
async def index(filters: Validated[ListPosts]):
    return filters.model_dump()
```

```bash
curl -H 'Accept: application/json' 'http://localhost:8000/posts?q=fastapi&page=2&tags=python&tags=web'
# {"q":"fastapi","page":2,"tags":["python","web"]}

curl -H 'Accept: application/json' 'http://localhost:8000/posts'
# {"q":"","page":1,"tags":[]}

curl -H 'Accept: application/json' 'http://localhost:8000/posts?page=0'
# {"message":"The page field must be at least 1.","errors":{"page":["The page field must be at least 1."]}}
```

Query keys the model doesn't declare are ignored. Field aliases work too: a field declared with `PydanticField(10, alias="pageSize")` reads `?pageSize=`. In the OpenAPI schema, the model's fields are listed as query parameters for these routes instead of a request body.

On `POST`, `PUT` and `PATCH` routes, the JSON body is validated. Any query parameters the model declares are merged in underneath it, so a key in the body wins over the same key in the query string. A write request with no body at all is rejected with `{"": ["Field required"]}` in `errors`.

## Writing the Validation Rules

### How Rules Run

Validation happens in two passes over one input:

1. **Types.** Pydantic parses the input into the model. A field that fails here, such as `"high"` for an `int`, gets Pydantic's message.
2. **Rules.** Each field's rules run in the order you chained them, and the first one that fails supplies the field's message. A field that already failed its type check is skipped.

Errors from both passes are reported together in one response:

```python
class StoreTask(FormRequest):
    title: Annotated[str, Field().required().min(3)]
    priority: int = 0
```

```json
{
  "message": "Input should be a valid integer, unable to parse string as an integer (and 1 more error)",
  "errors": {
    "priority": ["Input should be a valid integer, unable to parse string as an integer"],
    "title": ["The title field must be at least 3 characters."]
  }
}
```

Apart from `required` and `required_if`, rules skip empty values: `None`, an empty or whitespace-only string, and an empty list, tuple, set or dict. So `Field().email()` on an optional field accepts a missing value but rejects `"nope"`. A field with `required()` or `required_if()` that's left out of the input gets the rule's message, `The title field is required.`, rather than Pydantic's `Field required`.

### Stopping on the First Failure

By default, every field is validated. To stop at the first field that fails, set `stop_on_first_failure`:

```python
class Wizard(FormRequest):
    stop_on_first_failure = True

    first: Annotated[str, Field().required()]
    second: Annotated[str, Field().required()]
```

Posting `{}` reports only `{"first": ["The first field is required."]}`.

### Nested Models

Rules belong on the fields of the `FormRequest` itself. A nested Pydantic model can be a field type, but declaring a class whose nested model has rules raises `TypeError: Outer.inner: validation rules on nested model Inner are not supported.` Using a rule-annotated field on a plain `BaseModel` raises an error saying `Validation rules need a FormRequest model.`

## Available Validation Rules

Each rule is a method on `Field` and returns the field, so rules chain. Every rule takes an optional `msg` argument; see [Custom Error Messages](#custom-error-messages).

| Rule | Passes when | Default message |
|---|---|---|
| `required()` | The value isn't empty. | The :attribute field is required. |
| `required_if(other, value)` | `other` doesn't equal `value`, or the value isn't empty. | The :attribute field is required when :other is :value. |
| `nullable()` | Always. Allows `None` as the value. | — |
| `string()` | The value is a `str`. | The :attribute field must be a string. |
| `integer()` | An `int` (not `bool`), or a string of digits. | The :attribute field must be an integer. |
| `numeric()` | An `int`, `float` or `Decimal` (not `bool`), or a numeric string. | The :attribute field must be a number. |
| `boolean()` | `True`, `False`, `0`, `1`, `"0"` or `"1"`. | The :attribute field must be true or false. |
| `min(n)` | The size is at least `n`. | The :attribute field must be at least :min characters. |
| `max(n)` | The size is at most `n`. | The :attribute field must not be greater than :max characters. |
| `between(lo, hi)` | The size is between `lo` and `hi`, inclusive. | The :attribute field must be between :min and :max characters. |
| `password()` | Same as `min(8)`. | The :attribute field must be at least 8 characters. |
| `email()` | A string shaped like `name@domain.tld`. | The :attribute field must be a valid email address. |
| `url()` | A string with a scheme and a host. | The :attribute field must be a valid URL. |
| `regex(pattern)` | A string where `pattern` matches (`re.search`). | The :attribute field format is invalid. |
| `in_(values)` | The value is in `values`. | The selected :attribute is invalid. |
| `not_in(values)` | The value isn't in `values`. | The selected :attribute is invalid. |
| `same_as(other)` | The value equals the `other` field's value. | The :attribute field must match :other. |
| `confirmed()` | The value equals the `<field>_confirmation` field's value. | The :attribute field confirmation does not match. |
| `unique(table, ...)` | No row has this value. See [Database Rules](#database-rules). | The :attribute has already been taken. |
| `exists(table, ...)` | A row has this value. | The selected :attribute is invalid. |
| `using(callback)` | `callback` returns true. See [Closures](#using-closures). | The :attribute field is invalid. |
| `add(rule)` | `rule.passes(...)` returns true. See [Custom Rules](#custom-validation-rules). | The rule's `message`. |

`Email()` is a shortcut for `Field().email()`:

```python
from fastapi_startkit.validation import Email, Field, FormRequest


class Register(FormRequest):
    email: Annotated[str, Email().required()]
    password: Annotated[str, Field().required().password().confirmed()]
    password_confirmation: str = ""
```

### Sizes

`min`, `max` and `between` measure a string by its length, a list (or any other collection) by its item count, and a number by its value. The message changes to match:

| Value | `min(3)` message |
|---|---|
| String | The :attribute field must be at least 3 characters. |
| Number | The :attribute field must be at least 3. |
| List | The :attribute field must have at least 3 items. |

When the field also has `integer()` or `numeric()`, its value is always compared as a number, so `Field().numeric().between(1, 5)` checks `"9"` as nine, not as one character.

### Nullable and Required Fields

`required()`, `required_if()` and `nullable()` let a field accept `None` during the type pass, so the rules can report it. A required field still fails on `None`. Use `nullable()` for a field that may be explicitly `null`:

```python
class Profile(FormRequest):
    nickname: Annotated[str | None, Field().nullable().string()] = None
```

`required_if` compares the other field's value after type coercion, and formats `True` and `False` as `true` and `false`:

```python
class Order(FormRequest):
    shipping: bool = False
    address: Annotated[str | None, Field().required_if("shipping", True)] = None
```

Validating `{"shipping": true}` reports `{"address": ["The address field is required when shipping is true."]}`.

### Database Rules

`unique` and `exists` check a table with the [query builder](/docs/database/). Pass a table name or a model class. The column defaults to the field's name:

```python
class UpdateAccount(FormRequest):
    email: Annotated[str, Email().required().unique("accounts", ignore=lambda data: data["account_id"])]
    team_id: Annotated[int, Field().required().exists("teams", "id")]


@app.fastapi.put("/accounts/{account_id}")
async def update(account_id: int, data: Validated[UpdateAccount]):
    return {"id": account_id, "email": data.email}
```

`unique(table, column=None, ignore=None, ignore_column="id")` excludes the row whose `ignore_column` equals `ignore`, so a user can keep their own email. `ignore` can be a value, or a callable that receives the validation data and returns the value; it may be async. The data includes the route's [path parameters](#path-parameters), which is how `account_id` above reaches the rule.

With `jane@example.com` stored as account 1 and only team 1 in `teams`:

```bash
curl -X PUT http://localhost:8000/accounts/1 -H 'Content-Type: application/json' \
  -d '{"email": "jane@example.com", "team_id": 1}'
# {"id":1,"email":"jane@example.com"}

curl -X PUT http://localhost:8000/accounts/2 -H 'Content-Type: application/json' \
  -d '{"email": "jane@example.com", "team_id": 9}'
# {"message":"The email has already been taken. (and 1 more error)","errors":{"email":["The email has already been taken."],"team_id":["The selected team id is invalid."]}}
```

## Custom Error Messages

Every rule method takes a `msg` argument, and `.msg()` replaces the message of the rule just before it:

```python
class Signup(FormRequest):
    name: Annotated[str, Field().required("Tell us your name.").min(3).msg("Give us at least :min characters.")]
    age: Annotated[int, Field().integer().min(18, lambda attribute, value, data: f"{value} is too young.")] = 18
```

```bash
curl -X POST http://localhost:8000/signup -H 'Content-Type: application/json' -d '{"age": 12}'
# {"message":"Tell us your name. (and 1 more error)","errors":{"name":["Tell us your name."],"age":["12 is too young."]}}

curl -X POST http://localhost:8000/signup -H 'Content-Type: application/json' -d '{"name": "Al"}'
# {"message":"Give us at least 3 characters.","errors":{"name":["Give us at least 3 characters."]}}
```

A message is either a string or a callable that takes `(attribute, value, data)` and returns a string. String messages can use these placeholders:

| Placeholder | Replaced with |
|---|---|
| `:attribute` | The field name, with underscores and dots turned into spaces (`team_id` → `team id`). |
| `:min`, `:max` | The bounds of `min`, `max` and `between`. |
| `:other` | The other field of `required_if` and `same_as`. |
| `:value` | The expected value of `required_if`. |

Calling `.msg()` before any rule raises `ValueError: msg() needs a rule before it.`

## Custom Validation Rules

### Rule Objects

For a rule you'll reuse, subclass `Rule` and implement `passes`. For one that needs to await something, subclass `AsyncRule`. Attach either with `add()`:

```python
from collections.abc import Mapping
from typing import Annotated, Any

from fastapi_startkit.validation import AsyncRule, Field, FormRequest, Rule


async def reserved_handles() -> set[str]:
    return {"admin", "root"}


class Uppercase(Rule):
    message = "The :attribute field must be uppercase."

    def passes(self, attribute: str, value: Any, data: Mapping[str, Any]) -> bool:
        return isinstance(value, str) and value.isupper()


class NotReserved(AsyncRule):
    message = "The :attribute is reserved."

    async def passes(self, attribute: str, value: Any, data: Mapping[str, Any]) -> bool:
        return value not in await reserved_handles()


class StoreCode(FormRequest):
    code: Annotated[str, Field().required().add(Uppercase())]
    handle: Annotated[str, Field().required().add(NotReserved())]
```

Posting `{"code": "abc", "handle": "admin"}` reports `{"code": ["The code field must be uppercase."], "handle": ["The handle is reserved."]}`.

`passes` receives the field name, its value, and the whole validation data, so a rule can look at other fields. A rule's constructor takes an optional message, so `Uppercase("Shout it.")` overrides `message` for that one use. Like the built-in rules, custom rules don't run when the value is empty.

### Using Closures

For a one-off check, pass a function to `using()`. It takes `(attribute, value, data)` and returns a bool, or an awaitable bool:

```python
class StoreSlug(FormRequest):
    slug: Annotated[str, Field().required().using(lambda attribute, value, data: "-" not in value, "No dashes in the :attribute.")]
```

Posting `{"slug": "a-b"}` reports `{"slug": ["No dashes in the slug."]}`. Without a message, a failing closure reports `The :attribute field is invalid.`

## Form Request Hooks

A form request can override three class methods. Each receives a [`Validator`](#the-validator) and may be sync or async. They run in this order:

1. `authorize` — before any input is read.
2. `prepare_for_validation` — before the type pass, with the raw input.
3. The type pass and the field rules.
4. `after` — once the rules have run, even if some failed.

```python
class StoreComment(FormRequest):
    body: Annotated[str, Field().required().min(3)]
    author: str = "guest"

    @classmethod
    async def authorize(cls, validator: Validator) -> bool:
        return validator.request is not None and validator.request.headers.get("x-role") != "banned"

    @classmethod
    def prepare_for_validation(cls, validator: Validator) -> None:
        validator.merge({"body": str(validator.data.get("body", "")).strip()})

    @classmethod
    async def after(cls, validator: Validator) -> None:
        if "spam" in validator.data["body"]:
            validator.errors.add("body", "No spam, please.")
        if validator.data["author"] == "guest" and validator.context.get("post_id") == 1:
            validator.errors.add("author", "Guests cannot comment on this post.")


@app.fastapi.post("/posts/{post_id}/comments")
async def comment(post_id: int, data: Validated[StoreComment]):
    return {"post_id": post_id, "body": data.body, "author": data.author}
```

```bash
curl -X POST http://localhost:8000/posts/2/comments -H 'Content-Type: application/json' -d '{"body": "  nice post  "}'
# {"post_id":2,"body":"nice post","author":"guest"}

curl -X POST http://localhost:8000/posts/2/comments -H 'Content-Type: application/json' -d '{"body": "buy spam now"}'
# {"message":"No spam, please.","errors":{"body":["No spam, please."]}}

curl -X POST http://localhost:8000/posts/1/comments -H 'Content-Type: application/json' -d '{"body": "nice post"}'
# {"message":"Guests cannot comment on this post.","errors":{"author":["Guests cannot comment on this post."]}}

curl -X POST http://localhost:8000/posts/2/comments -H 'Content-Type: application/json' -H 'X-Role: banned' -d '{"body": "nice"}'
# 403 {"detail":"This action is unauthorized."}
```

### Authorizing the Request

When `authorize` returns false, an `AuthorizationException` is raised and the client gets a 403 with `{"detail": "This action is unauthorized."}`. No input is parsed and no rules run.

### Preparing Input

`prepare_for_validation` is the place to normalise input before it's checked: trim strings, fill in a default, rename a key. Change the input with `validator.merge({...})`, which updates `validator.data`.

### After Hooks

`after` runs once the rules are done. Use it for checks that span several fields, or that only make sense once the values are typed. Add an error with `validator.errors.add(field, message)`; any error makes the request fail. Call `validator.fails()` to see whether anything has failed so far.

## The Validator

Each hook receives a `Validator`:

| Attribute | Contents |
|---|---|
| `validator.data` | The input. In `authorize` it's empty, in `prepare_for_validation` it holds the raw input, and in `after` it holds the path parameters, model defaults and raw input, overlaid with the values coerced to their field types. |
| `validator.context` | The route's path parameters, converted to their declared types (`{"post_id": 1}`). Empty outside a request unless you pass a context. |
| `validator.request` | The Starlette `Request`, or `None` when you call [`validate_input`](#validating-outside-a-request) without one. |
| `validator.errors` | The [`MessageBag`](#working-with-error-messages) of errors so far. |
| `validator.merge(values)` | Updates `validator.data` and returns the validator. |
| `validator.fails()` | `True` if any error has been recorded. |

### Path Parameters

Path parameters are handed to the form request as `validator.context`, typed the way the route declares them, and they're also part of the data rules receive. Path parameters declared on a router prefix or in a route dependency count too. If a path parameter fails its own type check, such as `/posts/abc/comments` for `post_id: int`, the client gets a 422 for `post_id` and the form request doesn't run, so no database rule sees the bad value.

## Multiple Form Requests

A route can take more than one `Validated` parameter, or mix one with other body parameters. The body is then embedded: each form request reads the key named after its class in snake case (`StorePost` → `store_post`), and its errors are prefixed with that key:

```python
class Billing(FormRequest):
    name: Annotated[str, Field().required().min(3)]


class Shipping(FormRequest):
    name: Annotated[str, Field().required().min(5)]


@app.fastapi.post("/checkout")
async def checkout(billing: Validated[Billing], shipping: Validated[Shipping]):
    return {"billing": billing.name, "shipping": shipping.name}
```

```bash
curl -X POST http://localhost:8000/checkout -H 'Content-Type: application/json' \
  -d '{"billing": {"name": "Jo"}, "shipping": {"name": "Jo"}}'
```

```json
{
  "message": "The name field must be at least 3 characters. (and 1 more error)",
  "errors": {
    "billing.name": ["The name field must be at least 3 characters."],
    "shipping.name": ["The name field must be at least 5 characters."]
  }
}
```

The key comes from the class name, not the parameter name. With a route like `note(data: Validated[StorePost], note: Annotated[str, Body()])`, the body is `{"store_post": {...}, "note": "..."}`. All of a route's form requests are validated before the response is sent, so the client sees every error at once.

## Validating Outside a Request

`validate_input` runs the same steps without a route, which is handy in commands, jobs and tests. It returns the model, or raises `ValidationException` (or `AuthorizationException`):

```python
from fastapi_startkit.validation import ValidationException

post = await StorePost.validate_input({"title": "Hello", "body": "A long enough body"})
post.status  # "draft"

try:
    await StorePost.validate_input({"title": "Hello"})
except ValidationException as error:
    error.errors              # {"body": ["The body field is required."]}
    error.bag.first("body")   # "The body field is required."
```

The signature is `validate_input(data, context=None, request=None)`. `context` becomes `validator.context`, and `request` becomes `validator.request`. A hook that depends on the request, like `StoreComment.authorize` above, sees `None` here and decides accordingly.

An MCP tool whose `schema()` returns a form request is validated this way on every call. A failure is answered as a JSON-RPC error with the field messages in `data`; see [Validating input with a FormRequest](/docs/ai/mcp#validating-input-with-a-formrequest).

## Error Responses

When validation fails, a `ValidationException` is raised and `FastAPIProvider`'s handler builds the response. It picks the response from the request headers:

| Request | Response |
|---|---|
| Has an `X-Inertia` header | A 303 redirect back, with the errors shared to the next page. See [Inertia validation errors](/docs/frontend/inertia#validation-errors). |
| `Accept` contains `application/json`, or `Content-Type` starts with `application/json` | A 422 JSON response. |
| Anything else | The errors are flashed to `request.session["errors"]` when the app has session middleware, and the client gets a 303 redirect back. |

"Back" is the `Referer` header when it's a path on the same site (`/posts/create`) or a URL on the same origin; otherwise it's `/`.

The same handler formats FastAPI's own `RequestValidationError`, so a plain Pydantic body parameter fails with the same shape, and the `body`/`query` prefix is dropped from the field name.

### The JSON Response

```json
{
  "message": "The title field is required. (and 2 more errors)",
  "errors": {
    "title": ["The title field is required."],
    "body": ["The body field must be at least 10 characters."],
    "status": ["The selected status is invalid."]
  }
}
```

- `errors` maps each field to its list of messages. Field rules contribute one message per field, and `after` hooks can add more. Nested and embedded fields use dot notation (`billing.name`).
- `message` is the first message. When there are more, it ends with `(and N more error)` or `(and N more errors)`.
- The status is always 422.

### GET Requests and the Accept Header

A query string has no `Content-Type`, so a failed `GET` only gets the JSON response when the client sends `Accept: application/json`:

```bash
curl -i -H 'Accept: application/json' 'http://localhost:8000/posts?page=0'
# HTTP/1.1 422 Unprocessable Entity
# {"message":"The page field must be at least 1.","errors":{"page":["The page field must be at least 1."]}}

curl -i -H 'Referer: http://localhost:8000/posts?page=1' 'http://localhost:8000/posts?page=0'
# HTTP/1.1 303 See Other
# location: http://localhost:8000/posts?page=1
```

This is what you want for a browser following a link, but an API client that forgets the header gets a redirect instead of the errors. Send `Accept: application/json` from API clients. The same applies to a `POST` without a JSON `Content-Type`.

## Working With Error Messages

`ValidationException.bag` and `validator.errors` are `MessageBag` instances:

```python
from fastapi_startkit.validation import MessageBag

bag = MessageBag({"email": ["The email field is required."], "name": "The name field is required."})
bag.add("email", "The email field must be a valid email address.")

bag.has("email")    # True
bag.get("email")    # ["The email field is required.", "The email field must be a valid email address."]
bag.first("email")  # "The email field is required."
bag.first()         # "The email field is required."
bag.all()           # all three messages, in order
bag.count()         # 3
bag.any()           # True
bag.summary()       # "The email field is required. (and 2 more errors)"
bag.to_dict()       # {"message": bag.summary(), "errors": bag.messages}
```

`merge(other, prefix=None)` copies another bag's messages in, optionally prefixing each field (`prefix="billing"` turns `name` into `billing.name`).

### Raising Errors Yourself

To fail a request with your own errors, raise `ValidationException` with a dict or a `MessageBag`. It gets the same [response](#error-responses):

```python
from fastapi_startkit.validation import ValidationException

raise ValidationException({"email": ["The email has already been taken."]})
```
