---
outline: deep
title: Database Testing
description: Test your database logic with automatic migrations and transactions in FastAPI Startkit.
keywords: database testing, migrations, transactions, orm, pytest
---

# Database Testing

Tests that write to the database need a clean state, or a row created in one test shows up in the next. The `RefreshDatabase` and `DatabaseTransaction` mixins wrap each test in a transaction and roll it back when the test ends, so every test starts from the same data.

- [Installation](#installation)
- [Using a Test Database](#using-a-test-database)
- [Resetting the Database](#resetting-the-database)
- [Testing Against an Existing Schema](#testing-against-an-existing-schema)
- [Checking the Database](#checking-the-database)

## Installation

Install the `database` extra with a driver extra, such as `sqlite`, and add pytest and pytest-asyncio as dev dependencies:

```bash
uv add "fastapi-startkit[database,sqlite]"
uv add --dev pytest pytest-asyncio
```

Configure pytest in `pyproject.toml`:

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["."]
testpaths = ["tests"]
```

## Using a Test Database

Under pytest, the application runs in the `testing` environment and loads `.env.testing` on top of `.env`. Point the tests at their own database there, so a test run never touches your development data:

```ini
# .env.testing
DB_DATABASE=databases/testing.sqlite
```

See [Configuration](/docs/configuration) for how environment files are loaded.

## Resetting the Database

Add `RefreshDatabase` to a test class. It migrates the test database once per test run, before the first test that uses it, by dropping every table and running your migrations from `databases/migrations`. It then wraps each test in a transaction on the default connection and rolls it back when the test ends.

```python
# tests/test_teams.py
from fastapi_startkit.fastapi.testing import HttpTestCase
from fastapi_startkit.masoniteorm.testing import RefreshDatabase

from app.models.team import Team


class TestTeams(RefreshDatabase, HttpTestCase):
    def get_application(self):
        from bootstrap.application import app

        return app

    async def test_it_creates_a_team(self):
        response = await self.post("/api/teams", json={"name": "Phoenix Suns", "sport": "basketball"})

        response.assert_created()

        team = await Team.where("name", "Phoenix Suns").first()
        assert team.sport == "basketball"

    async def test_it_rejects_a_duplicate_name(self):
        await Team.create({"name": "Phoenix Suns", "sport": "basketball"})

        response = await self.post("/api/teams", json={"name": "Phoenix Suns", "sport": "basketball"})

        response.assert_status(422)
```

Both tests create a team called Phoenix Suns. They don't clash, because each test's rows are rolled back before the next test starts. Seeders don't run, so every test starts with empty tables.

The mixins run from the setup and teardown of the framework's `TestCase`, which `HttpTestCase` extends. A test class that doesn't extend one of them, such as a plain pytest class, doesn't get the reset.

::: tip Browser tests
A live server writes through its own connections, so a rollback can't undo what happens during a browser test. Use `DatabaseTruncation` there. See [Resetting the Database](/docs/testing/browser#resetting-the-database) in the browser testing docs.
:::

## Testing Against an Existing Schema

`DatabaseTransaction` gives you the same rollback without running migrations. Use it when the test database's schema is already in place, for example one you migrate yourself before the run:

```python
# tests/test_team_queries.py
from fastapi_startkit.fastapi.testing import HttpTestCase
from fastapi_startkit.masoniteorm.testing import DatabaseTransaction

from app.models.team import Team


class TestTeamQueries(DatabaseTransaction, HttpTestCase):
    def get_application(self):
        from bootstrap.application import app

        return app

    async def test_it_finds_a_team_by_name(self):
        await Team.create({"name": "Phoenix Suns", "sport": "basketball"})

        team = await Team.where("name", "Phoenix Suns").first()

        assert team.sport == "basketball"
```

To migrate the test database yourself, run the migrations with `APP_ENV=testing`:

```bash
APP_ENV=testing uv run python artisan db:migrate
```

## Checking the Database

Query your models inside a test to check what a request wrote. The rollback removes these rows too, so there's nothing to clean up:

```python
async def test_it_stores_the_team_once(self):
    await self.post("/api/teams", json={"name": "Phoenix Suns", "sport": "basketball"})

    assert await Team.where("name", "Phoenix Suns").count() == 1
```

See [FastAPI Testing](/docs/testing/fastapi) for the request helpers and response assertions.
