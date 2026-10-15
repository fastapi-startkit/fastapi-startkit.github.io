---
outline: deep
title: Database Testing
description: Test your database logic with automatic migrations and transactions in Fastapi Startkit.
keywords: database testing, migrations, transactions, orm, pytest
---

# Database Testing

Two mixins keep database state isolated between tests: `RefreshDatabase` and `DatabaseTransaction`. Both wrap each test in a transaction and roll it back when the test ends.

## Installation

```bash
uv add fastapi-startkit --extra database
uv add --dev pytest pytest-asyncio
```

Set `asyncio_mode = "auto"` so tests can run as coroutines:

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
asyncio_default_test_loop_scope = "function"
pythonpath = ["."]
```

The two loop-scope settings silence deprecation warnings from pytest-asyncio 0.23. `pythonpath = ["."]` puts the project root on `sys.path`, so `from bootstrap.application import app` resolves.

## `RefreshDatabase`

`RefreshDatabase` runs `migrate:fresh` once per test session, before the first test that uses it. It then wraps each test in a transaction that is rolled back afterwards.

```python
from fastapi_startkit.masoniteorm.testing import RefreshDatabase
```

Migrations are loaded from `databases/migrations/` under the base path of the running application.

### `get_application()`

The mixins use the application that is already booted, so your test case must provide one through `get_application()`. `HttpTestCase` requires this method, and one implementation covers both:

```python
from fastapi_startkit.fastapi.testing import HttpTestCase
from fastapi_startkit.masoniteorm.testing import RefreshDatabase
from app.models.user import User


class TestRegister(HttpTestCase, RefreshDatabase):
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

        user = await User.where("email", "john@example.com").first()
        assert user is not None
        assert user.name == "John Doe"
        assert user.role == "student"

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

### How it works

- `migrate:fresh` drops every table and runs the migrations again. This happens once per session.
- Before each test, the mixin opens a transaction on the default connection.
- After each test, it rolls the transaction back, so the next test sees the same data.

The mixins hook into `asyncSetUp` and `asyncTearDown` of the framework `TestCase`, which `HttpTestCase` extends. A plain `unittest` or pytest class won't run them.

## `DatabaseTransaction`

`DatabaseTransaction` does the same rollback without running migrations. Use it when the schema already exists, for example a database you migrate yourself.

```python
from fastapi_startkit.fastapi.testing import HttpTestCase
from fastapi_startkit.masoniteorm.testing import DatabaseTransaction
from app.models.user import User


class TestUserQueries(HttpTestCase, DatabaseTransaction):
    def get_application(self):
        from bootstrap.application import app
        return app

    async def test_can_find_user_by_email(self):
        await User.create({"name": "Alice", "email": "alice@example.com", "role": "admin"})

        user = await User.where("email", "alice@example.com").first()
        assert user is not None
        assert user.role == "admin"
```

The transaction is rolled back, so this `User` is gone before the next test runs.

## Choosing Between the Two

| | `RefreshDatabase` | `DatabaseTransaction` |
|---|---|---|
| Runs `migrate:fresh` | Yes, once per session | No |
| Isolates each test | Yes, via rollback | Yes, via rollback |
| Needs a booted application | Yes, from `get_application()` | Yes, from `get_application()` |
| Best for | Full integration tests | Tests against an existing schema |

## Querying the Database Directly

Query the ORM inside a test to assert on what the request wrote. The rollback cleans it up:

```python
async def test_creates_user_on_register(self):
    await self.post("/students/register", json={
        "name": "John Doe",
        "email": "john@example.com",
        "password": "password123",
    })

    count = await User.where("email", "john@example.com").count()
    assert count == 1
```
