---
outline: deep
title: FastAPI Testing
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

`HttpTestCase` exposes async wrappers around the four most common HTTP methods. All keyword arguments are forwarded directly to the underlying `httpx.AsyncClient` method.

| Method | Signature |
|---|---|
| `get` | `await self.get(url, **kwargs)` |
| `post` | `await self.post(url, **kwargs)` |
| `put` | `await self.put(url, **kwargs)` |
| `delete` | `await self.delete(url, **kwargs)` |

Pass a JSON body with `json=`, form data with `data=`, headers with `headers=`, and so on — anything `httpx` accepts.

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

If you need features not covered by the convenience helpers (e.g. `PATCH`, custom auth headers on every request, streaming), access `self.client` directly. It is a fully configured `httpx.AsyncClient`.

```python
async def test_update_profile(self):
    response = await self.client.patch("/profile", json={"name": "New Name"})
    assert response.status_code == 200
```
