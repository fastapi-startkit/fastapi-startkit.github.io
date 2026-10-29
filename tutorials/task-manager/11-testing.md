---
lesson: 11
title: Testing
description: Write HTTP tests that run against their own database and roll back after each test.
duration: 7
---

# Testing

**Goal:** tests for the task API that run against a separate database.

## 1. Use a test database

Your tests shouldn't touch the data you work with. Under pytest the app runs in the `testing` environment, and it loads `.env.testing` on top of `.env`. Create `.env.testing`:

```ini
DB_DATABASE=databases/testing.sqlite
TASKS_PER_PAGE=10
```

Everything else comes from `.env`, so only list what's different.

## 2. Write the tests

The installer already made `tests/test_application.py`, which checks `/health`. Add `tests/test_tasks.py` next to it:

```python
from fastapi_startkit.fastapi.testing import HttpTestCase
from fastapi_startkit.masoniteorm.testing import RefreshDatabase

from app.models.project import Project
from app.models.task import Task


class TestTasks(RefreshDatabase, HttpTestCase):
    def get_application(self):
        from bootstrap.application import app

        return app

    async def test_it_creates_a_task(self):
        project = await Project.create({"name": "Website"})

        response = await self.post("/api/tasks", json={"project_id": project.id, "title": "Write copy"})

        response.assert_created().assert_json(
            lambda json: json.where("title", "Write copy").where("completed", False).etc()
        )
        assert await Task.where("title", "Write copy").count() == 1

    async def test_title_is_required(self):
        project = await Project.create({"name": "Website"})

        response = await self.post("/api/tasks", json={"project_id": project.id, "title": ""})

        response.assert_status(422).assert_json_structure({"errors": ["title"]})

    async def test_it_completes_a_task(self):
        project = await Project.create({"name": "Website"})
        task = await Task.create({"project_id": project.id, "title": "Write copy"})

        response = await self.put(f"/api/tasks/{task.id}", json={"completed": True})

        response.assert_ok().assert_json(lambda json: json.where("completed", True).etc())

    async def test_it_deletes_a_task(self):
        project = await Project.create({"name": "Website"})
        task = await Task.create({"project_id": project.id, "title": "Write copy"})

        (await self.delete(f"/api/tasks/{task.id}")).assert_no_content()
        (await self.get(f"/api/tasks/{task.id}")).assert_status(404)
```

Here's what the two base classes give you:

- `HttpTestCase` sends requests to your app without starting a server. `self.get()`, `self.post()`, `self.put()` and `self.delete()` return a response with assertions like `assert_created()` and `assert_json()`.
- `RefreshDatabase` runs your migrations on a fresh database once, then wraps each test in a transaction and rolls it back. Every test starts with empty tables.

`assert_json()` is strict: it fails if the response has keys you didn't check. `etc()` says the other keys are fine.

## Check

```bash
uv run pytest
```

```
5 passed
```

Break something on purpose, like the `201` in `store()`, and run the tests again to see one fail. Then put it back.
