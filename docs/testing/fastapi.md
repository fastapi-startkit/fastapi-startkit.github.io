---
outline: deep
title: FastAPI Testing
description: Learn how to write robust integration tests for your FastAPI endpoints using Fastapi Startkit.
keywords: testing, fastapi, integration tests, pytest
---

# FastAPI Testing

Fastapi Startkit ships a purpose-built `HttpTestCase` that spins up your actual FastAPI application and sends real HTTP requests through it — no mocking, no monkeypatching. Every test talks to the same app you deploy.

## Installation

The testing helpers live in the `fastapi` extra. Install it alongside the standard test dependencies:

```bash
uv add fastapi-startkit --extra fastapi
uv add --dev pytest pytest-asyncio httpx
```

## The `HttpTestCase` Class

`HttpTestCase` is an abstract base class that sets up an `httpx.AsyncClient` backed by your FastAPI instance before each test, and tears it down after.

```python
from fastapi_startkit.fastapi.testing import HttpTestCase
```

You must subclass it and implement `get_application()`, which should return your booted `Application` instance:

```python
class TestRegister(HttpTestCase):
    def get_application(self):
        from bootstrap.application import app
        return app
```

The `get_application()` method is called once per test via a pytest fixture — return the same singleton `app` every time so providers don't re-register on every test run.

## HTTP Helpers

`HttpTestCase` exposes async wrappers around the most common HTTP methods. All keyword arguments are forwarded directly to the underlying `httpx.AsyncClient` method.

| Method | Signature |
|---|---|
| `get` | `await self.get(url, **kwargs)` |
| `post` | `await self.post(url, **kwargs)` |
| `put` | `await self.put(url, **kwargs)` |
| `patch` | `await self.patch(url, **kwargs)` |
| `delete` | `await self.delete(url, **kwargs)` |

Pass a JSON body with `json=`, form data with `data=`, headers with `headers=`, and so on — anything `httpx` accepts.

Each helper returns a `TestResponse` — a thin wrapper around `httpx.Response` that adds fluent assertion helpers (`assert_status`, `assert_ok`, `assert_json`, and more) while forwarding everything else to the underlying response. See [Fluent JSON Assertions](#fluent-json-assertions) for the full API.

## Writing Tests

Tests are async methods prefixed with `test_`. pytest-asyncio handles the event loop automatically when `asyncio_mode = "auto"` is set in `pyproject.toml`.

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
asyncio_default_test_loop_scope = "function"
pythonpath = ["."]
```

`asyncio_default_fixture_loop_scope` and `asyncio_default_test_loop_scope` suppress deprecation warnings introduced in pytest-asyncio 0.23. `pythonpath = ["."]` adds the project root to `sys.path` so imports like `from bootstrap.application import app` resolve without extra configuration.

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
        # missing required fields
        response = await self.post("/students/register", json={})
        assert response.status_code == 422

        # password too short
        response = await self.post("/students/register", json={
            "name": "John Doe",
            "email": "john@example.com",
            "password": "short",
        })
        assert response.status_code == 422

        # invalid email
        response = await self.post("/students/register", json={
            "name": "John Doe",
            "email": "not-an-email",
            "password": "password123",
        })
        assert response.status_code == 422

        # name too short
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

If you need features not covered by the convenience helpers (e.g. `OPTIONS`, `HEAD`, custom auth headers on every request, streaming), access `self.client` directly. It is a fully configured `httpx.AsyncClient`. Note that calling the client directly returns a raw `httpx.Response`, not a `TestResponse`, so the fluent assertion helpers are not available.

```python
async def test_preflight(self):
    response = await self.client.options("/profile")
    assert response.status_code == 204
```

## Fluent JSON Assertions

Every HTTP helper (`get`, `post`, `put`, `patch`, `delete`) returns a `TestResponse` instead of a raw `httpx.Response`. `TestResponse` wraps the real response and adds a small set of expressive assertion helpers, including a fluent `AssertableJson` API for inspecting JSON bodies.

```python
response = await self.post("/teams", json=payload)

response.assert_created().assert_json(lambda json: (
    json.where("id", 1)
        .where("name", "Phoenix Suns")
        .etc()
))
```

`TestResponse` transparently forwards every attribute it doesn't define to the underlying `httpx.Response`, so `response.status_code`, `response.json()`, `response.headers` and `response.text` continue to work exactly as before. Existing tests that used plain assertions keep passing.

### Status Assertions

`TestResponse` provides shortcuts for the most common status checks. Each one returns the same `TestResponse`, so calls chain.

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

When the status does not match, the failure message includes the expected and actual codes **and the response body**, so you can see why the request failed:

```
AssertionError: Expected status code [200] but received [422]. Body: {"detail":[...]}
```

### JSON Body Assertions

#### `assert_json(callback=None, *, exact=None)`

Run fluent assertions against the decoded JSON body. The callback receives an `AssertableJson` instance scoped to the root of the body.

```python
response.assert_json(lambda json: (
    json.where("id", 1)
        .where("name", "Phoenix Suns")
        .etc()
))
```

To assert the body matches a dictionary exactly, pass `exact=`:

```python
response.assert_json(exact={"id": 1, "name": "Phoenix Suns"})
```

#### `assert_json_structure(structure)`

Assert that the body contains a given set of keys without caring about values. Use a list of key names for an object, nest dictionaries for deeper structures, and use the `"*"` wildcard to apply a structure to **every** element of a list.

```python
response.assert_json_structure({
    "teams": {
        "*": ["name", "sport"],
    },
})
```

A leaf may map to `None` in dict form to assert presence only:

```python
response.assert_json_structure({"meta": None, "data": ["id", "name"]})
```

### The `AssertableJson` API

`AssertableJson` is the object passed to your `assert_json` callback. Every method returns the same instance, so assertions chain fluently. It is built around four ideas:

- **Dot-path keys** — address nested values with `"profile.email"`, and even index into lists with `"teams.0.name"`.
- **Predicate matchers** — pass a callable anywhere a value is expected to run a custom check.
- **Nested scoping** — descend into a sub-object or list element with `has(key, callback)`.
- **The strict interaction model** — every key of an object must be asserted, or the test fails. Call `etc()` to acknowledge the rest.

#### Matching values

| Method | Description |
|---|---|
| `where(key, expected)` | assert `key` equals `expected`, or passes the `expected` predicate if it is callable |
| `where_not(key, expected)` | assert `key` does **not** equal `expected` (or fails the predicate) |
| `where_all(bindings)` | assert each `{key: expected}` pair via `where` |
| `where_type(key, type)` | assert `key` is one of the given JSON type name(s) |
| `where_all_type(bindings)` | assert each `{key: type}` pair via `where_type` |

```python
json.where("name", "Phoenix Suns")          # literal value
json.where("score", lambda v: v > 100)       # predicate matcher
json.where_not("status", "banned")
json.where_all({"id": 1, "active": True})
```

##### Predicate matchers

Any value argument can be a callable. It receives the actual value and must return something truthy for the assertion to pass:

```python
json.where("email", lambda v: v.endswith("@example.com"))
json.where("tags", lambda v: "featured" in v)
```

##### Types with `where_type`

Supported type names are `string`, `integer`, `double`, `number`, `boolean`, `array`, `object`, and `null`. Pass a pipe-separated string or a list to allow a union of types:

```python
json.where_type("name", "string")
json.where_type("deleted_at", "string|null")
json.where_type("tags", ["array", "null"])
```

Booleans are treated as a distinct JSON type: `True`/`False` satisfy `boolean` but **not** `integer`, even though Python's `bool` is a subclass of `int`.

#### Asserting presence

| Method | Description |
|---|---|
| `has(key, length?, callback?)` | assert `key` exists; optionally assert its size and/or scope into it |
| `has_all(*keys)` | assert every key exists |
| `has_any(*keys)` | assert at least one key exists |
| `missing(key)` | assert `key` is absent |
| `missing_all(*keys)` | assert none of the keys exist |
| `count(key, n)` | assert the collection at `key` has exactly `n` items |

`has` supports several shorthands:

```python
json.has("teams")                        # presence only
json.has("teams", 3)                     # presence + length 3
json.has("profile", lambda p: ...)       # presence + nested scope
json.has("teams", 3, lambda t: ...)      # length + nested scope
```

```python
json.has_all("id", "name", "email")
json.has_any("phone", "mobile")
json.missing("password")
json.count("teams", 3)
```

#### Nested scoping

Passing a callback to `has` descends into that key. The callback receives a **new** `AssertableJson` scoped to the nested value, and that scope is verified independently (its own keys must all be asserted or `etc()`'d).

```python
response.assert_json(lambda json: (
    json.has("profile", lambda profile: (
        profile.where("email", "john@example.com")
               .where("verified", True)
               .etc()
    )).etc()
))
```

Because dot-paths index into lists, you can scope into a specific element:

```python
json.has("teams", 3)
json.has("teams.0", lambda team: team.where("name", "Phoenix Suns").etc())
```

#### Iterating collections

| Method | Description |
|---|---|
| `first(callback)` | scope into the first child element and run `callback` |
| `each(callback)` | run `callback` against every child element in its own scope |

```python
json.has("teams", lambda teams: teams.first(lambda team: (
    team.where("name", "Phoenix Suns").etc()
)))

json.has("teams", lambda teams: teams.each(lambda team: (
    team.where_all_type({"name": "string", "sport": "string"})
)))
```

#### The strict interaction model

`AssertableJson` records every key you touch. When a scope closes (at the end of `assert_json`, or at the end of a `has`/`first`/`each` callback), it asserts that **every** key of the object was interacted with. This catches unexpected or leaked fields — for example a `password` hash that should never reach the client.

If you don't intend to assert on the remaining keys, call `etc()` to acknowledge them:

```python
# Body: {"id": 1, "name": "Phoenix Suns", "sport": "basketball"}

# ❌ Fails — "name" and "sport" were never asserted
response.assert_json(lambda json: json.where("id", 1))

# ✅ Passes — etc() acknowledges the untouched keys
response.assert_json(lambda json: json.where("id", 1).etc())
```

The failure message names exactly what was left:

```
AssertionError: Unexpected properties were found at [root]: ['name', 'sport'].
Interact with them or call .etc().
```

#### Helpful error messages

Every assertion reports the **full dot-path** to the offending key, so failures point straight at the problem even deep inside a nested body:

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

        # Shape check: a list of teams, each with name + sport.
        response.assert_ok().assert_json_structure({
            "teams": {"*": ["name", "sport"]},
        })

        # Value checks with the fluent API.
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

The following methods exist as placeholders and raise `NotImplementedError`; they are planned for a future release:

- `where_contains(key, expected)`
- `count_between(key, min, max)`
