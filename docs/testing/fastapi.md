---
outline: deep
title: FastAPI Testing
description: Write integration tests for your FastAPI endpoints with HttpTestCase in FastAPI Startkit.
keywords: testing, fastapi, integration tests, pytest
---

# FastAPI Testing

`HttpTestCase` sends HTTP requests to your application from your tests, without starting a server. Requests go through the same routes, middleware and providers as they do in production, and each response comes back with assertions for status codes, JSON bodies and streamed output.

- [Installation](#installation)
- [Writing Tests](#writing-tests)
- [Making Requests](#making-requests)
- [Status Assertions](#status-assertions)
- [Fluent JSON Assertions](#fluent-json-assertions)
- [Asserting JSON Structure](#asserting-json-structure)
- [Asserting Response Content](#asserting-response-content)
- [Testing Streamed Responses](#testing-streamed-responses)

## Installation

The testing helpers ship with the `fastapi` extra. Add pytest and pytest-asyncio as dev dependencies:

```bash
uv add "fastapi-startkit[fastapi]"
uv add --dev pytest pytest-asyncio
```

Then configure pytest in `pyproject.toml`:

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["."]
testpaths = ["tests"]
```

`pythonpath = ["."]` puts the project root on the import path, so your tests can import `bootstrap.application`. Projects created with `fastapi-startkit init` already have these settings.

## Writing Tests

Create a test class that extends `HttpTestCase` and returns your application from `get_application()`. Each test is an `async` method whose name starts with `test_`:

```python
# tests/test_teams.py
from fastapi_startkit.fastapi.testing import HttpTestCase


class TestTeams(HttpTestCase):
    def get_application(self):
        from bootstrap.application import app

        return app

    async def test_it_creates_a_team(self):
        response = await self.post("/api/teams", json={"name": "Phoenix Suns", "sport": "basketball"})

        response.assert_created().assert_json(lambda json: (
            json.where("name", "Phoenix Suns")
                .where("sport", "basketball")
                .etc()
        ))

    async def test_it_requires_a_name(self):
        response = await self.post("/api/teams", json={"sport": "basketball"})

        response.assert_status(422)
```

Run the suite with pytest:

```bash
uv run pytest
```

When a test also writes to the database, add `RefreshDatabase` so each test starts with empty tables. See [Database Testing](/docs/testing/database).

## Making Requests

`HttpTestCase` has an async helper for each common HTTP method. Each one passes its keyword arguments to the matching `httpx.AsyncClient` method, so you send a JSON body with `json=`, form data with `data=`, query parameters with `params=` and headers with `headers=`:

| Method | Signature |
|---|---|
| `get` | `await self.get(url, **kwargs)` |
| `post` | `await self.post(url, **kwargs)` |
| `put` | `await self.put(url, **kwargs)` |
| `patch` | `await self.patch(url, **kwargs)` |
| `delete` | `await self.delete(url, **kwargs)` |

```python
response = await self.get("/api/teams", params={"sport": "basketball"}, headers={"Accept": "application/json"})
```

Every helper returns a `TestResponse`. It adds the assertion methods on this page and passes everything else through to the `httpx.Response`, so `response.status_code`, `response.json()`, `response.headers` and `response.text` work as usual. `response.response` returns the `httpx.Response` itself.

For other methods, such as `OPTIONS` or `HEAD`, use `self.client`, the underlying `httpx.AsyncClient`. It returns a plain `httpx.Response` without the assertion methods:

```python
async def test_head_request(self):
    response = await self.client.head("/health")

    assert response.status_code == 405
```

## Status Assertions

Each status assertion returns the `TestResponse`, so you can chain another assertion after it:

| Method | Asserts |
|---|---|
| `assert_status(code)` | The status equals `code` |
| `assert_ok()` | The status is `200` |
| `assert_created()` | The status is `201` |
| `assert_no_content()` | The status is `204` |

```python
response.assert_status(422)
response.assert_created().assert_json(lambda json: json.where("name", "Phoenix Suns").etc())
```

A failure shows the expected code, the actual code and the response body:

```text
AssertionError: Expected status code [201] but received [422]. Body: {"message":"The name field is required.",...}
```

## Fluent JSON Assertions

`assert_json()` passes the decoded body to your callback as an `AssertableJson`. Each of its methods returns the same instance, so you chain the checks you need:

```python
response.assert_json(lambda json: (
    json.where("id", 1)
        .where("name", "Phoenix Suns")
        .etc()
))
```

To compare the whole body with a value, pass `exact=` instead:

```python
response.assert_json(exact={"teams": [{"name": "Phoenix Suns", "sport": "basketball"}]})
```

Keys are dot paths. `"coach.name"` reaches into a nested object and `"teams.0.name"` reads the first item of a list.

### Matching Values

| Method | Asserts |
|---|---|
| `where(key, expected)` | `key` equals `expected`, or passes `expected` when it is a callable |
| `where_not(key, expected)` | `key` doesn't equal `expected`, or fails it when it is a callable |
| `where_all(bindings)` | `where()` for each `{key: expected}` pair |
| `where_type(key, type)` | `key` has one of the given JSON types |
| `where_all_type(bindings)` | `where_type()` for each `{key: type}` pair |

```python
json.where("name", "Phoenix Suns")
json.where("id", lambda value: value > 0)
json.where_not("sport", "hockey")
json.where_all({"name": "Phoenix Suns", "sport": "basketball"})
```

A callable receives the value and passes when it returns something truthy.

The type names for `where_type()` are `string`, `integer`, `double`, `number`, `boolean`, `array`, `object` and `null`. Pass a pipe-separated string or a list to allow more than one:

```python
json.where_type("name", "string")
json.where_type("coach", "object|null")
json.where_type("tags", ["array", "null"])
```

`True` and `False` match `boolean`, not `integer`.

### Asserting Presence

| Method | Asserts |
|---|---|
| `has(key, length=None, callback=None)` | `key` exists, optionally with `length` items, optionally scoping into it |
| `has_all(*keys)` | Every key exists |
| `has_any(*keys)` | At least one key exists |
| `missing(key)` | `key` doesn't exist |
| `missing_all(*keys)` | None of the keys exist |
| `count(key, length)` | The list or object at `key` has exactly `length` items |

```python
json.has("teams")
json.has("teams", 3)
json.has_all("id", "name", "sport")
json.has_any("phone", "email")
json.missing("password")
json.count("teams", 3)
```

### Scoping Into Nested Data

Pass a callback to `has()` to run assertions inside a nested object. The callback receives a new `AssertableJson` for that key:

```python
response.assert_json(lambda json: (
    json.where("name", "Phoenix Suns")
        .has("coach", lambda coach: coach.where("name", "Mike Budenholzer").etc())
        .etc()
))
```

`has("teams", 3, callback)` checks the length and scopes in at the same time. A dot path scopes into a single list item:

```python
json.has("teams.0", lambda team: team.where("name", "Phoenix Suns").etc())
```

### Iterating Collections

`first()` runs a callback on the first item of the current scope, and `each()` runs it on every item:

```python
response.assert_json(lambda json: (
    json.has("teams", lambda teams: teams.first(lambda team: team.where("name", "Phoenix Suns").etc()))
))

response.assert_json(lambda json: (
    json.has("teams", lambda teams: teams.each(lambda team: team.where_all_type({"name": "string", "sport": "string"})))
))
```

### The Strict Interaction Model

`AssertableJson` records every key you check. When a scope closes, at the end of `assert_json()` or of a `has()`, `first()` or `each()` callback, it fails if the object has keys you didn't check. For example, a `password` field that slipped into a response fails the test.

Call `etc()` to accept the keys you didn't check:

```python
# Body: {"id": 1, "name": "Phoenix Suns", "sport": "basketball", "coach": {...}}

response.assert_json(lambda json: json.where("id", 1))        # fails
response.assert_json(lambda json: json.where("id", 1).etc())  # passes
```

The failure lists the keys you missed:

```text
AssertionError: Unexpected properties were found at [root]: ['coach', 'name', 'sport']. Interact with them or call .etc().
```

Every failure names the full dot path of the key:

```text
AssertionError: Property [teams.0.sport] does not exist.
AssertionError: Property [name] does not match. Expected ['Phoenix Suns'], got ['Chicago Bulls'].
```

## Asserting JSON Structure

`assert_json_structure()` checks that keys exist without checking their values. Use a list of key names for an object, a nested dict for a deeper level, and `"*"` to apply a structure to every item of a list:

```python
response.assert_json_structure({
    "teams": {
        "*": ["name", "sport"],
    },
})
```

Map a key to `None` to check only that it exists:

```python
response.assert_json_structure({"coach": None, "name": None})
```

## Asserting Response Content

`assert_contents()` checks that the response body contains each of the given strings. Use it for HTML and other responses that aren't JSON:

```python
async def test_team_page(self):
    response = await self.get("/teams")

    response.assert_ok().assert_contents("<h1>Phoenix Suns</h1>", "Basketball")
```

## Testing Streamed Responses

For a Server-Sent Events response, with a `text/event-stream` content type, `TestResponse` reads the `data:` lines of the body. Take this endpoint:

```python
# app/http/controllers/team_controller.py
from fastapi.responses import StreamingResponse


class TeamController:
    async def scores(self):
        async def events():
            for score in ["98", "101", "104"]:
                yield f"data: {score}\n\n"

        return StreamingResponse(events(), media_type="text/event-stream")
```

`assert_stream()` with one string compares it with all the chunks joined together. With several strings, it compares the exact list of chunks. `assert_stream_contains()` checks that the joined content contains each string:

```python
async def test_scores_stream(self):
    response = await self.get("/api/teams/scores")

    response.assert_stream("98101104")
    response.assert_stream("98", "101", "104")
    response.assert_stream_contains("101")
```

To read the stream yourself, `stream_chunks()` returns the list of chunks, `stream_content()` returns them joined, and `is_stream()` tells you whether the response is a stream. The stream assertions fail on a response that isn't `text/event-stream`. Use `assert_contents()` for those.

See [Database Testing](/docs/testing/database) to reset the database between tests, and [Browser Testing](/docs/testing/browser) to test pages in a real browser.
