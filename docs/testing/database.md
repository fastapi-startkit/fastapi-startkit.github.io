---
outline: deep
title: Database Testing
---

# Database Testing

Fastapi Startkit provides two mixins for keeping database state isolated between tests: `RefreshDatabase` and `DatabaseTransaction`. Both wrap each test in a transaction that is rolled back when the test ends, so no test ever contaminates the next.

## Installation

```bash
uv add fastapi-startkit --extra database
uv add --dev pytest pytest-asyncio
```

Make sure `asyncio_mode = "auto"` is set so all tests can run as coroutines:

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
asyncio_default_test_loop_scope = "function"
pythonpath = ["."]
```

`asyncio_default_fixture_loop_scope` and `asyncio_default_test_loop_scope` suppress deprecation warnings introduced in pytest-asyncio 0.23. `pythonpath = ["."]` adds the project root to `sys.path` so imports like `from bootstrap.application import app` resolve without extra configuration.

## `RefreshDatabase`

`RefreshDatabase` runs `migrate:fresh` once before any tests execute, then wraps every individual test in a transaction that is rolled back on completion. This guarantees each test starts against a clean, fully-migrated schema.

```python
from fastapi_startkit.orm.testing import RefreshDatabase
```

It reads your migrations from `databases/migrations/` by default.

### `get_application()`

`RefreshDatabase` calls `get_application()` before running migrations so the application (and its database connection) is initialized. When you also subclass `HttpTestCase`, a single `get_application()` implementation satisfies both:

```python
from fastapi_startkit.fastapi.testing import HttpTestCase
from fastapi_startkit.orm.testing import RefreshDatabase
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

- Migrations run once via `migrate:fresh` (drops all tables and re-creates them).
- Every test is wrapped in a database transaction. Commits inside the test are silently discarded.
- The transaction is rolled back after `yield`, leaving the database in the same state for the next test.

## `DatabaseTransaction`

`DatabaseTransaction` is a lighter alternative that skips the migration step. Use it when your schema is already in place (e.g. you only want isolation without a full reset) or when you are testing against a database that you manage separately.

```python
from fastapi_startkit.orm.testing import DatabaseTransaction
```

```python
from fastapi_startkit.fastapi.testing import HttpTestCase
from fastapi_startkit.orm.testing import DatabaseTransaction
from app.models.user import User


class TestUserQueries(HttpTestCase, DatabaseTransaction):
    def get_application(self):
        from bootstrap.application import app
        return app

    async def test_can_find_user_by_email(self):
        await User.create(name="Alice", email="alice@example.com", role="admin")

        user = await User.where("email", "alice@example.com").first()
        assert user is not None
        assert user.role == "admin"
```

Because the transaction is rolled back, the `User` record created above is never persisted and will not appear in other tests.

## Choosing Between the Two

| | `RefreshDatabase` | `DatabaseTransaction` |
|---|---|---|
| Runs `migrate:fresh` | Yes, once | No |
| Isolates each test | Yes, via rollback | Yes, via rollback |
| Requires `get_application()` | Yes | No (but `HttpTestCase` does) |
| Best for | Full integration tests | Fast unit/query tests |

## Querying the Database Directly

Both mixins let you query the ORM directly inside tests — no special setup required. Since changes are wrapped in a rolled-back transaction, you can assert on database state without worrying about cleanup:

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
