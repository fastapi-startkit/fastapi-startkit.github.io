---
lesson: 7
title: Issues
description: Add issues with per-project keys, a status and priority from enums, and a reporter and assignee.
duration: 10
---

# Issues

**Goal:** create issues in a project, each with the next key for that project, like `WEB-1` and `WEB-2`.

## 1. Name the statuses and priorities

Statuses and priorities are fixed lists, so make them enums. A `StrEnum` stores as plain text and validates for free. Create `app/enums.py`:

```python
from enum import StrEnum


class IssueStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class IssuePriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"
```

## 2. Create the table

```bash
uv run python artisan db:make:migration create_issues_table --create issues
```

```python
from fastapi_startkit.masoniteorm import Migration


class CreateIssuesTable(Migration):
    async def up(self):
        async with await self.schema.create("issues") as table:
            table.increments("id")
            table.integer("project_id").unsigned() # [!code ++]
            table.foreign("project_id").references("id").on("projects").on_delete("cascade") # [!code ++]
            table.integer("number").unsigned() # [!code ++]
            table.string("key", 20).unique() # [!code ++]
            table.string("title") # [!code ++]
            table.text("description").nullable() # [!code ++]
            table.string("status", 20).default("todo") # [!code ++]
            table.string("priority", 20).default("medium") # [!code ++]
            table.integer("reporter_id").unsigned() # [!code ++]
            table.foreign("reporter_id").references("id").on("users") # [!code ++]
            table.integer("assignee_id").unsigned().nullable() # [!code ++]
            table.foreign("assignee_id").references("id").on("users").on_delete("set null") # [!code ++]
            table.timestamps()
            table.unique(["project_id", "number"]) # [!code ++]

    async def down(self):
        await self.schema.drop("issues")
```

A few columns are worth a closer look:

- `number` counts issues inside one project. `unique(["project_id", "number"])` means `WEB` and `APP` can both have an issue 1, but `WEB` can't have two.
- `key` stores the full `WEB-1` so you can look an issue up by it.
- Two columns point at `users`. `reporter_id` is who filed the issue, and `assignee_id` is who's working on it. When a user is deleted, `set null` unassigns their issues instead of deleting them.

Run it:

```bash
uv run python artisan db:migrate
```

## 3. Add the model and its relationships

Create `app/models/issue.py`:

```python
from typing import TYPE_CHECKING

from fastapi_startkit.masoniteorm.models import Model
from fastapi_startkit.masoniteorm.relationships import BelongsTo

from app.enums import IssuePriority, IssueStatus

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class Issue(Model):
    id: int
    project_id: int
    number: int
    key: str
    title: str
    description: str
    status: IssueStatus
    priority: IssuePriority
    reporter_id: int
    assignee_id: int | None

    project = BelongsTo["Project"](local_key="project_id", foreign_key="id")
    reporter = BelongsTo["User"](local_key="reporter_id", foreign_key="id")
    assignee = BelongsTo["User"](local_key="assignee_id", foreign_key="id")
```

Because `status` and `priority` are annotated with the enums, the model turns the stored text into `IssueStatus` and `IssuePriority` values when it reads a row.

A relationship tells a model how its rows connect to another table:

- `BelongsTo` is the side that holds the foreign key. An issue belongs to one project, one reporter and maybe one assignee.
- `local_key` is the column on this model and `foreign_key` is the column on the other one. `reporter` and `assignee` both point at `User`, so `local_key` is what tells them apart.
- The model names are strings, like `"Project"`. The `TYPE_CHECKING` imports let your editor know what they are, without the two files importing each other when the app runs.

## 4. Number issues in the project

A project has many issues, and it's also the one that knows what the next number is. Give `Project` the other side of the relationship and an `add_issue()` method in `app/models/project.py`:

```python
from fastapi_startkit.masoniteorm.models import Model
from fastapi_startkit.masoniteorm.relationships import HasMany # [!code ++]
# [!code ++]
from app.enums import IssueStatus # [!code ++]
from app.models.issue import Issue # [!code ++]


class Project(Model):
    id: int
    key: str
    name: str
    description: str

    issues = HasMany[Issue](local_key="id", foreign_key="project_id") # [!code ++]
# [!code ++]
    async def add_issue(self, attributes: dict) -> Issue: # [!code ++]
        number = (await Issue.where("project_id", self.id).max("number") or 0) + 1 # [!code ++]
        return await Issue.create( # [!code ++]
            { # [!code ++]
                **attributes, # [!code ++]
                "project_id": self.id, # [!code ++]
                "number": number, # [!code ++]
                "key": f"{self.key}-{number}", # [!code ++]
                "status": IssueStatus.TODO, # [!code ++]
            } # [!code ++]
        ) # [!code ++]
```

Here's what `add_issue()` does:

- `max("number")` finds the highest number in the project. It's `None` when the project has no issues yet, so `or 0` starts the count at 1.
- The key is the project's key plus that number, so the first issue in `WEB` is `WEB-1`.
- `create()` sends back only the columns you passed in, not the table's defaults. That's why `status` is set here instead of left to the column default.
- `Project` uses `Issue` when the app runs, so it imports it normally. `issue.py` only names `"Project"` for your editor, so the two files never load each other.

Keeping this in the model means every place that files an issue numbers it the same way. You'll file issues from a second place in lesson 12.

## 5. Validate new issues

Create `app/http/requests/issue.py`:

```python
from typing import Annotated

from fastapi_startkit.validation import Field, FormRequest

from app.enums import IssuePriority


class StoreIssueRequest(FormRequest):
    title: Annotated[str, Field().required().max(255)]
    description: str | None = None
    priority: IssuePriority = IssuePriority.MEDIUM
    reporter_id: Annotated[int, Field().required().exists("users", "id")]
    assignee_id: Annotated[int | None, Field().nullable().exists("users", "id")] = None
```

`exists("users", "id")` checks that the user is really there. `nullable()` lets `assignee_id` be left out or set to `null`, for an issue nobody has picked up yet. A `priority` outside the enum is refused.

## 6. Shape the output

Create `app/http/resources/issue.py`. It nests the reporter and assignee with the `UserResource` you already have:

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.enums import IssuePriority, IssueStatus
from app.http.resources.user import UserResource


class IssueResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    title: str
    description: str | None
    status: IssueStatus
    priority: IssuePriority
    reporter: UserResource
    assignee: UserResource | None
    created_at: datetime
```

## 7. Add the controller

Create `app/http/controllers/issue_controller.py`:

```python
from fastapi import Response
from fastapi_startkit.validation import Validated

from app.http.requests.issue import StoreIssueRequest
from app.http.resources.issue import IssueResource
from app.models.issue import Issue
from app.models.project import Project


class IssueController:
    async def index(self, project: int) -> list[IssueResource]:
        found = await Project.find_or_fail(project)
        issues = await Issue.with_("reporter", "assignee").where("project_id", found.id).order_by("number").get()
        return [IssueResource.model_validate(issue) for issue in issues]

    async def store(self, project: int, request: Validated[StoreIssueRequest], response: Response) -> IssueResource:
        found = await Project.find_or_fail(project)
        issue = await found.add_issue(request.model_dump())
        await issue.load("reporter", "assignee")
        response.status_code = 201
        return IssueResource.model_validate(issue)

    async def show(self, issue: int) -> IssueResource:
        found = await Issue.find_or_fail(issue)
        await found.load("reporter", "assignee")
        return IssueResource.model_validate(found)
```

The controller stays small. It finds the project, lets the model add the issue and shapes the result.

`with_("reporter", "assignee")` loads both users for every issue in two extra queries, instead of two per issue. `load()` does the same for a model you already have. You'll see why that matters in lesson 10.

## 8. Add the routes

Issues live inside a project, so their routes nest under it. `resource()` builds flat routes, so write these out in `routes/api.py`:

```python
from app.http.controllers.home_controller import HomeController
from app.http.controllers.issue_controller import IssueController # [!code ++]
from app.http.controllers.project_controller import ProjectController
from app.http.controllers.user_controller import UserController
from fastapi_startkit.fastapi import Router

controller = HomeController()
router = Router()
router.get("/", controller.index, response_model=None)
router.get("/health", controller.health)

issues = IssueController() # [!code ++]
# [!code ++]
api = Router(prefix="/api")
api.resource("users", UserController, only=["index"])
api.resource("projects", ProjectController, only=["index", "store", "show"])
api.get("/projects/{project}/issues", issues.index) # [!code ++]
api.post("/projects/{project}/issues", issues.store) # [!code ++]
api.get("/issues/{issue}", issues.show) # [!code ++]
```

## Check

File an issue in the `WEB` project, assigned to Grace:

```bash
curl -X POST http://127.0.0.1:8000/api/projects/1/issues \
  -H "Content-Type: application/json" \
  -d '{"title": "Homepage hero image is blurry", "priority": "high", "reporter_id": 1, "assignee_id": 2}'
```

```json
{
  "id": 1,
  "key": "WEB-1",
  "title": "Homepage hero image is blurry",
  "description": null,
  "status": "todo",
  "priority": "high",
  "reporter": {"id": 1, "name": "Ada Lovelace", "email": "ada@example.com"},
  "assignee": {"id": 2, "name": "Grace Hopper", "email": "grace@example.com"},
  "created_at": "2026-11-06T19:10:12.641536Z"
}
```

File one more in `WEB` and one in `APP`. They get `WEB-2` and `APP-1`, because each project counts on its own:

```bash
curl -X POST http://127.0.0.1:8000/api/projects/1/issues \
  -H "Content-Type: application/json" \
  -d '{"title": "Add a pricing page", "reporter_id": 2}'

curl -X POST http://127.0.0.1:8000/api/projects/2/issues \
  -H "Content-Type: application/json" \
  -d '{"title": "App crashes on launch", "reporter_id": 3}'
```

`curl http://127.0.0.1:8000/api/projects/1/issues` now lists `WEB-1` and `WEB-2`.

Try an unknown priority and a user who doesn't exist. Both fields are named in the `422`:

```bash
curl -X POST http://127.0.0.1:8000/api/projects/1/issues \
  -H "Content-Type: application/json" \
  -d '{"title": "Broken link", "priority": "critical", "reporter_id": 1, "assignee_id": 99}'
```

```json
{
  "message": "Input should be 'low', 'medium', 'high' or 'urgent' (and 1 more error)",
  "errors": {
    "priority": ["Input should be 'low', 'medium', 'high' or 'urgent'"],
    "assignee_id": ["The selected assignee id is invalid."]
  }
}
```

::: info Compare your code
This lesson's code is tagged [`lesson-07`](https://github.com/fastapi-startkit/issue-tracker/tree/lesson-07). See [the changes in this lesson](https://github.com/fastapi-startkit/issue-tracker/compare/lesson-06...lesson-07).
:::
