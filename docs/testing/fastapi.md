---
outline: deep
title: FastAPI Testing
description: Write integration tests for your FastAPI endpoints with HttpTestCase in Fastapi Startkit.
keywords: testing, fastapi, integration tests, pytest
---

# FastAPI Testing

`HttpTestCase` sends HTTP requests to your FastAPI application in memory, through an `httpx` ASGI transport. Your tests exercise the same routes, middleware, and providers as production.

## Installation

The testing helpers are part of the `fastapi` extra:

```bash
uv add fastapi-startkit --extra fastapi
uv add --dev pytest pytest-asyncio httpx
```

## The `HttpTestCase` Class

Before each test, `HttpTestCase` opens an `httpx.AsyncClient` against your FastAPI instance. It closes the client after the test.

```python
from fastapi_startkit.fastapi.testing import HttpTestCase
```

Subclass it and implement `get_application()` to return your booted `Application`:

```python
class TestRegister(HttpTestCase):
    def get_application(self):
        from bootstrap.application import app
        return app
```

`get_application()` is called for every test. Return the same `app` singleton each time, so providers are not registered again.

## HTTP Helpers

Each helper is async and passes its keyword arguments to the matching `httpx.AsyncClient` method:

| Method | Signature |
|---|---|
| `get` | `await self.get(url, **kwargs)` |
| `post` | `await self.post(url, **kwargs)` |
| `put` | `await self.put(url, **kwargs)` |
| `patch` | `await self.patch(url, **kwargs)` |
| `delete` | `await self.delete(url, **kwargs)` |

Send a JSON body with `json=`, form data with `data=`, and headers with `headers=`.

Each helper returns a `TestResponse`. It wraps the `httpx.Response` and adds assertion methods such as `assert_status`, `assert_ok`, and `assert_json`. See [Fluent JSON Assertions](#fluent-json-assertions).

## Writing Tests

Write tests as async methods whose names start with `test_`. With `asyncio_mode = "auto"`, pytest-asyncio runs them:

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
asyncio_default_test_loop_scope = "function"
pythonpath = ["."]
```

The two loop-scope settings silence deprecation warnings from pytest-asyncio 0.23. `pythonpath = ["."]` puts the project root on `sys.path`, so `from bootstrap.application import app` resolves.

### Example — Registration Endpoint

```python
from fastapi_startkit.fastapi.testing import HttpTestCase


class TestRegister(HttpTestCase):
    def get_application(self):
        from bootstrap.application import app
        return app

    async def test_user_can_register(self):
        response = await self.post("/students/register", json={
            "name": "John Doe",
            "email": "john@example.com",
            "password": "password123",
        })

        assert response.status_code == 200
        assert response.json()["message"] == "Student registered successfully"
        assert "user_id" in response.json()

    async def test_user_cannot_register_with_invalid_data(self):
        response = await self.post("/students/register", json={})
        assert response.status_code == 422

        response = await self.post("/students/register", json={
            "name": "John Doe",
            "email": "john@example.com",
            "password": "short",
        })
        assert response.status_code == 422

        response = await self.post("/students/register", json={
            "name": "John Doe",
            "email": "not-an-email",
            "password": "password123",
        })
        assert response.status_code == 422

        response = await self.post("/students/register", json={
            "name": "J",
            "email": "john@example.com",
            "password": "password123",
        })
        assert response.status_code == 422

    async def test_user_cannot_register_with_duplicate_email(self):
        payload = {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "password": "password123",
        }

        await self.post("/students/register", json=payload)

        response = await self.post("/students/register", json=payload)
        assert response.status_code == 400
        assert response.json()["detail"] == "Email already registered"
```

## Accessing the Raw Client

`self.client` is the `httpx.AsyncClient`. Use it for anything the helpers don't cover, such as `OPTIONS` or `HEAD` requests or streaming. It returns a plain `httpx.Response`, so the `TestResponse` assertions are not available.

```python
async def test_preflight(self):
    response = await self.client.options("/profile")
    assert response.status_code == 204
```

## Fluent JSON Assertions

`TestResponse` adds assertion methods, including an `AssertableJson` API for checking JSON bodies:

```python
response = await self.post("/teams", json=payload)

response.assert_created().assert_json(lambda json: (
    json.where("id", 1)
        .where("name", "Phoenix Suns")
        .etc()
))
```

Any attribute that `TestResponse` doesn't define is read from the `httpx.Response`. `response.status_code`, `response.json()`, `response.headers`, and `response.text` work as before.

### Status Assertions

Each method returns the `TestResponse`, so you can chain calls.

| Method | Asserts |
|---|---|
| `assert_status(code)` | the response status equals `code` |
| `assert_ok()` | status is `200` |
| `assert_created()` | status is `201` |
| `assert_no_content()` | status is `204` |

```python
response.assert_status(422)
response.assert_ok()
response.assert_created().assert_json(...)
```

On a mismatch, the failure message shows the expected code, the actual code, and the response body:

```
AssertionError: Expected status code [200] but received [422]. Body: {"detail":[...]}
```

### JSON Body Assertions

#### `assert_json(callback=None, *, exact=None)`

The callback receives an `AssertableJson` scoped to the root of the decoded body:

```python
response.assert_json(lambda json: (
    json.where("id", 1)
        .where("name", "Phoenix Suns")
        .etc()
))
```

Pass `exact=` to compare the whole body to a dict:

```python
response.assert_json(exact={"id": 1, "name": "Phoenix Suns"})
```

#### `assert_json_structure(structure)`

Checks that keys exist and ignores their values. Use a list of key names for an object and nested dicts for deeper levels. The `"*"` key applies a structure to every element of a list.

```python
response.assert_json_structure({
    "teams": {
        "*": ["name", "sport"],
    },
})
```

In dict form, map a key to `None` to check only that it exists:

```python
response.assert_json_structure({"meta": None, "data": ["id", "name"]})
```

### The `AssertableJson` API

Your `assert_json` callback receives an `AssertableJson`. Each method returns the same instance, so you can chain them.

Keys are dot-paths. `"profile.email"` reaches a nested value and `"teams.0.name"` indexes into a list. Wherever a value is expected you can pass a callable instead. Every key of an object must be asserted, or you call `etc()` to accept the rest. See [The strict interaction model](#the-strict-interaction-model).

#### Matching values

| Method | Description |
|---|---|
| `where(key, expected)` | assert `key` equals `expected`, or passes `expected` if it is callable |
| `where_not(key, expected)` | assert `key` does not equal `expected`, or fails the predicate |
| `where_all(bindings)` | call `where` for each `{key: expected}` pair |
| `where_type(key, type)` | assert `key` has one of the given JSON types |
| `where_all_type(bindings)` | call `where_type` for each `{key: type}` pair |

```python
json.where("name", "Phoenix Suns")
json.where("score", lambda v: v > 100)
json.where_not("status", "banned")
json.where_all({"id": 1, "active": True})
```

##### Predicate matchers

A callable receives the actual value. The assertion passes when it returns something truthy:

```python
json.where("email", lambda v: v.endswith("@example.com"))
json.where("tags", lambda v: "featured" in v)
```

##### Types with `where_type`

The type names are `string`, `integer`, `double`, `number`, `boolean`, `array`, `object`, and `null`. To allow several types, pass a pipe-separated string or a list:

```python
json.where_type("name", "string")
json.where_type("deleted_at", "string|null")
json.where_type("tags", ["array", "null"])
```

`True` and `False` match `boolean` but not `integer`, although Python's `bool` is a subclass of `int`.

#### Asserting presence

| Method | Description |
|---|---|
| `has(key, length?, callback?)` | assert `key` exists, and optionally check its length or scope into it |
| `has_all(*keys)` | assert every key exists |
| `has_any(*keys)` | assert at least one key exists |
| `missing(key)` | assert `key` is absent |
| `missing_all(*keys)` | assert none of the keys exist |
| `count(key, n)` | assert the collection at `key` has exactly `n` items |

`has` accepts these forms:

```python
json.has("teams")
json.has("teams", 3)
json.has("profile", lambda p: ...)
json.has("teams", 3, lambda t: ...)
```

```python
json.has_all("id", "name", "email")
json.has_any("phone", "mobile")
json.missing("password")
json.count("teams", 3)
```

#### Nested scoping

When you pass a callback to `has`, it receives a new `AssertableJson` scoped to that key. The nested scope is checked on its own, so its keys must also be asserted or covered by `etc()`.

```python
response.assert_json(lambda json: (
    json.has("profile", lambda profile: (
        profile.where("email", "john@example.com")
               .where("verified", True)
               .etc()
    )).etc()
))
```

A dot-path can scope into one list element:

```python
json.has("teams", 3)
json.has("teams.0", lambda team: team.where("name", "Phoenix Suns").etc())
```

#### Iterating collections

| Method | Description |
|---|---|
| `first(callback)` | run `callback` on the first child element |
| `each(callback)` | run `callback` on every child element, each in its own scope |

```python
json.has("teams", lambda teams: teams.first(lambda team: (
    team.where("name", "Phoenix Suns").etc()
)))

json.has("teams", lambda teams: teams.each(lambda team: (
    team.where_all_type({"name": "string", "sport": "string"})
)))
```

#### The strict interaction model

`AssertableJson` records each key you touch. When a scope closes, at the end of `assert_json` or of a `has`, `first`, or `each` callback, it fails if any key of the object was not asserted. This catches fields that should not be in the response, such as a `password` hash.

Call `etc()` to accept the keys you did not assert:

```python
# Body: {"id": 1, "name": "Phoenix Suns", "sport": "basketball"}

# Fails: "name" and "sport" were never asserted
response.assert_json(lambda json: json.where("id", 1))

# Passes
response.assert_json(lambda json: json.where("id", 1).etc())
```

The failure lists the remaining keys:

```
AssertionError: Unexpected properties were found at [root]: ['name', 'sport'].
Interact with them or call .etc().
```

#### Error messages

Failures give the full dot-path to the key:

```
AssertionError: Property [teams.0.sport] does not exist.
AssertionError: Property [profile.email] does not match. Expected ['a@b.com'], got ['x@y.com'].
```

### Complete Example

```python
from fastapi_startkit.fastapi.testing import HttpTestCase


class TestTeams(HttpTestCase):
    def get_application(self):
        from bootstrap.application import app
        return app

    async def test_create_team_returns_created_resource(self):
        response = await self.post("/api/teams", json={
            "name": "Phoenix Suns",
            "sport": "basketball",
        })

        response.assert_status(201).assert_json(lambda json: (
            json.where("id", lambda v: isinstance(v, int))
                .where("name", "Phoenix Suns")
                .where_type("sport", "string")
                .has("coach", lambda coach: (
                    coach.where("name", "Mike Budenholzer").etc()
                ))
                .missing("internal_notes")
                .etc()
        ))

    async def test_list_arizona_teams(self):
        response = await self.get("/api/teams/arizona")

        response.assert_ok().assert_json_structure({
            "teams": {"*": ["name", "sport"]},
        })

        response.assert_json(lambda json: (
            json.has("teams", 3)
                .has("teams.0", lambda team: (
                    team.where("name", "Phoenix Suns")
                        .where_all_type({"name": "string", "sport": "string"})
                        .etc()
                ))
                .etc()
        ))
```

### Not Yet Available

These methods are placeholders that raise `NotImplementedError`:

- `where_contains(key, expected)`
- `count_between(key, min, max)`
