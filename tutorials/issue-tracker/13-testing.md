---
lesson: 13
title: Testing
description: Test issue keys, validation, the workflow, comments, filters, edits and the board against a separate database.
duration: 8
---

# Testing

**Goal:** a test suite that proves the rules of your issue tracker and runs against its own database.

## 1. Use a test database

Under pytest the app runs in the `testing` environment and loads `.env.testing` on top of `.env`. Create `.env.testing` with the one value that's different:

```ini
DB_DATABASE=databases/testing.sqlite
```

`.gitignore` leaves out every `.env.*` file except `.env.example`, so each person who clones the project creates this file too.

## 2. Write the tests

Create `tests/test_issues.py`:

```python
from fastapi_startkit.fastapi.testing import HttpTestCase
from fastapi_startkit.inertia.testing import assert_inertia
from fastapi_startkit.masoniteorm.testing import RefreshDatabase

from app.models.issue import Issue
from app.models.project import Project
from app.models.user import User


class TestIssues(RefreshDatabase, HttpTestCase):
    def get_application(self):
        from bootstrap.application import app

        return app

    async def make_issue(self, **attributes) -> Issue:
        project = await Project.create({"key": "WEB", "name": "Website"})
        reporter = await User.create({"name": "Ada", "email": "ada@example.com"})
        response = await self.post(
            f"/api/projects/{project.id}/issues", json={"title": "Fix it", "reporter_id": reporter.id, **attributes}
        )
        return await Issue.find_or_fail(response.json()["id"])

    async def test_it_numbers_issues_per_project(self):
        first = await self.make_issue()
        response = await self.post(
            f"/api/projects/{first.project_id}/issues", json={"title": "Second", "reporter_id": first.reporter_id}
        )

        response.assert_created().assert_json(lambda json: json.where("key", "WEB-2").where("status", "todo").etc())

    async def test_it_rejects_an_unknown_assignee(self):
        project = await Project.create({"key": "WEB", "name": "Website"})
        reporter = await User.create({"name": "Ada", "email": "ada@example.com"})

        response = await self.post(
            f"/api/projects/{project.id}/issues", json={"title": "Fix it", "reporter_id": reporter.id, "assignee_id": 99}
        )

        response.assert_status(422).assert_json_structure({"errors": ["assignee_id"]})

    async def test_it_follows_the_workflow(self):
        issue = await self.make_issue()

        (await self.post(f"/api/issues/{issue.id}/transitions", json={"status": "in_progress"})).assert_ok()
        (await self.post(f"/api/issues/{issue.id}/transitions", json={"status": "in_review"})).assert_ok()

        response = await self.post(f"/api/issues/{issue.id}/transitions", json={"status": "todo"})
        response.assert_status(422).assert_json_structure({"errors": ["status"]})

    async def test_it_comments_on_an_issue(self):
        issue = await self.make_issue()

        response = await self.post(
            f"/api/issues/{issue.id}/comments", json={"author_id": issue.reporter_id, "body": "On it"}
        )

        response.assert_created()
        (await self.get(f"/api/issues/{issue.id}")).assert_json(
            lambda json: json.count("comments", 1).where("comments.0.body", "On it").etc()
        )

    async def test_it_filters_by_status(self):
        issue = await self.make_issue()
        await self.post(f"/api/projects/{issue.project_id}/issues", json={"title": "Other", "reporter_id": issue.reporter_id})
        await self.post(f"/api/issues/{issue.id}/transitions", json={"status": "in_progress"})

        response = await self.get(f"/api/projects/{issue.project_id}/issues?status=in_progress")

        response.assert_ok().assert_json(
            lambda json: json.where("total", 1).where("data.0.key", "WEB-1").etc()
        )

    async def test_it_edits_an_issue(self):
        issue = await self.make_issue()

        response = await self.patch(f"/api/issues/{issue.id}", json={"title": "Fix the header"})
        response.assert_ok().assert_json(lambda json: json.where("title", "Fix the header").etc())

        response = await self.patch(f"/api/issues/{issue.id}", json={"title": ""})
        response.assert_status(422).assert_json_structure({"errors": ["title"]})

    async def test_it_deletes_an_issue(self):
        issue = await self.make_issue()

        (await self.delete(f"/api/issues/{issue.id}")).assert_no_content()
        (await self.get(f"/api/issues/{issue.id}")).assert_status(404)

    async def test_the_board_shows_the_project_issues(self):
        issue = await self.make_issue()

        response = await self.get(f"/projects/{issue.project_id}/board")

        response.assert_ok()
        assert_inertia(response).component("Issues/Board").has_count("issues", 1).equals("issues.0.key", "WEB-1")
```

Here's what you're using:

- `RefreshDatabase` runs your migrations on the test database once. Then it wraps each test in a transaction and rolls it back when the test ends, so nothing a test writes is ever saved. Every test starts with empty tables, and the seeders don't run.
- `HttpTestCase` sends requests to the app without a server. `self.get()`, `self.post()`, `self.patch()` and `self.delete()` return a response with assertions such as `assert_created()`, `assert_no_content()`, `assert_status()` and `assert_json()`.
- `make_issue()` goes through the API instead of calling `Issue.create()`, so every test gets a key and status the same way a real client would.
- `assert_json()` fails on keys you didn't check unless you end with `etc()`. Dotted paths such as `comments.0.body` reach into lists. `count()` checks a list's length.
- `assert_json_structure({"errors": ["status"]})` checks that a `status` error is there without pinning its exact wording.
- `assert_inertia()` reads the page Inertia would render. `component()` checks which Vue page it is, and `has_count()` and `equals()` check its props, without a browser.

The test for the workflow is the most valuable one here. It walks the issue to In Review and checks that jumping back to To Do is refused, which is the rule your `after()` hook adds.

## Check

The board test renders `Issues/Board` with the frontend you built in lesson 12, so it fails if `npm run build` hasn't been run. Run the suite:

```bash
uv run pytest
```

```
tests/test_application.py .                                              [ 11%]
tests/test_issues.py ........                                            [100%]

9 passed
```

Break the workflow on purpose to see a test catch it. Add `IssueStatus.TODO` to the `IN_REVIEW` list in `WORKFLOW`, run `uv run pytest` again, and `test_it_follows_the_workflow` fails. Undo the change before you move on.

::: info Compare your code
This lesson's code is tagged [`lesson-13`](https://github.com/fastapi-startkit/issue-tracker/tree/lesson-13). See [the changes in this lesson](https://github.com/fastapi-startkit/issue-tracker/compare/lesson-12...lesson-13).
:::
