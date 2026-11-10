---
lesson: 11
title: Filtering and pagination
description: Filter a project's issues by status, priority and assignee, search their titles, sort them and page through them.
duration: 10
---

# Filtering and pagination

**Goal:** ask for "my in-progress issues" or "anything urgent" with a query string, one page at a time.

## 1. Seed some issues

Filters are easier to try with a board full of issues. Create a seeder:

```bash
uv run python artisan seed Issue
```

Fill in `databases/seeders/issue_table_seeder.py`. It numbers issues per project the same way the API does, and adds two comments to `WEB-1`:

```python
from fastapi_startkit.masoniteorm.seeders import Seeder

from app.models.comment import Comment
from app.models.issue import Issue
from app.models.project import Project

ISSUES = [
    ("WEB", "Homepage hero image is blurry", "in_progress", "high", 1, 2),
    ("WEB", "Add a pricing page", "todo", "medium", 2, None),
    ("WEB", "Contact form sends two emails", "in_review", "urgent", 3, 1),
    ("WEB", "Update the footer links", "done", "low", 1, 3),
    ("WEB", "Translate the homepage", "todo", "low", 2, None),
    ("APP", "App crashes on launch on Android 12", "in_progress", "urgent", 3, 2),
    ("APP", "Dark mode for the settings screen", "todo", "medium", 1, 3),
]


class IssueTableSeeder(Seeder):
    async def run(self) -> None:
        numbers: dict[str, int] = {}
        for key, title, status, priority, reporter_id, assignee_id in ISSUES:
            project = await Project.where("key", key).first()
            numbers[key] = numbers.get(key, 0) + 1
            await Issue.create(
                {
                    "project_id": project.id,
                    "number": numbers[key],
                    "key": f"{key}-{numbers[key]}",
                    "title": title,
                    "status": status,
                    "priority": priority,
                    "reporter_id": reporter_id,
                    "assignee_id": assignee_id,
                }
            )

        first = await Issue.where("key", "WEB-1").first()
        await Comment.create({"issue_id": first.id, "author_id": 2, "body": "I can reproduce this on Safari."})
        await Comment.create({"issue_id": first.id, "author_id": 1, "body": "Thanks, swapping in a sharper image."})
```

Call it from `DatabaseSeeder`, after the users and projects it needs:

```python
from databases.seeders.issue_table_seeder import IssueTableSeeder # [!code ++]
from databases.seeders.project_table_seeder import ProjectTableSeeder
from databases.seeders.user_table_seeder import UserTableSeeder


class DatabaseSeeder(Seeder):
    async def run(self):
        await self.call(UserTableSeeder, ProjectTableSeeder) # [!code --]
        await self.call(UserTableSeeder, ProjectTableSeeder, IssueTableSeeder) # [!code ++]
```

Reset the database with the new data:

```bash
uv run python artisan db:migrate:fresh
uv run python artisan db:seed
```

## 2. Describe the filters

`Validated` works on `GET` requests too. There it reads the query string, so filters get the same rules and `422` errors as a request body. Add a request to `app/http/requests/issue.py`:

```python
class IssueFilters(FormRequest): # [!code ++]
    status: list[IssueStatus] = [] # [!code ++]
    priority: list[IssuePriority] = [] # [!code ++]
    assignee_id: int | None = None # [!code ++]
    unassigned: bool = False # [!code ++]
    q: Annotated[str, Field().max(100)] = "" # [!code ++]
    sort: Annotated[str, Field().in_(["number", "-number", "updated_at", "-updated_at"])] = "-number" # [!code ++]
    page: Annotated[int, Field().min(1)] = 1 # [!code ++]
```

- `status` and `priority` are lists, so `?status=todo&status=in_progress` asks for either one. Every value is checked against the enum.
- `in_()` limits `sort` to the columns you mean to sort by. A leading `-` means newest first, which is also the default.
- Every field has a default, so a plain `GET` with no query string still works.

## 3. Build the query

Paginated results need the total and page numbers along with the issues. Add a page resource to `app/http/resources/issue.py`:

```python
class IssuePage(BaseModel): # [!code ++]
    data: list[IssueResource] # [!code ++]
    total: int # [!code ++]
    current_page: int # [!code ++]
    last_page: int # [!code ++]
```

Then rewrite `index()` in `IssueController`:

```python
from app.http.requests.issue import StoreIssueRequest, TransitionIssueRequest, UpdateIssueRequest # [!code --]
from app.http.resources.issue import IssueDetailResource, IssueResource # [!code --]
from app.http.requests.issue import IssueFilters, StoreIssueRequest, TransitionIssueRequest, UpdateIssueRequest # [!code ++]
from app.http.resources.issue import IssueDetailResource, IssuePage, IssueResource # [!code ++]
from app.models.issue import Issue
from app.models.project import Project
from config.issues import IssuesConfig # [!code ++]


class IssueController:
    async def index(self, project: int) -> list[IssueResource]: # [!code --]
        found = await Project.find_or_fail(project) # [!code --]
        issues = await Issue.with_("reporter", "assignee").where("project_id", found.id).order_by("number").get() # [!code --]
        return [IssueResource.model_validate(issue) for issue in issues] # [!code --]
    async def index(self, project: int, filters: Validated[IssueFilters]) -> IssuePage: # [!code ++]
        found = await Project.find_or_fail(project) # [!code ++]
        column = filters.sort.lstrip("-") # [!code ++]
        direction = "desc" if filters.sort.startswith("-") else "asc" # [!code ++]
        issues = await ( # [!code ++]
            Issue.with_("reporter", "assignee") # [!code ++]
            .where("project_id", found.id) # [!code ++]
            .when(filters.status, lambda query: query.where_in("status", filters.status)) # [!code ++]
            .when(filters.priority, lambda query: query.where_in("priority", filters.priority)) # [!code ++]
            .when(filters.assignee_id, lambda query: query.where("assignee_id", filters.assignee_id)) # [!code ++]
            .when(filters.unassigned, lambda query: query.where_null("assignee_id")) # [!code ++]
            .when(filters.q, lambda query: query.where("title", "like", f"%{filters.q}%")) # [!code ++]
            .order_by(column, direction) # [!code ++]
            .paginate(per_page=IssuesConfig().per_page, page=filters.page) # [!code ++]
        ) # [!code ++]
        return IssuePage( # [!code ++]
            data=[IssueResource.model_validate(issue) for issue in issues.result], # [!code ++]
            total=issues.total, # [!code ++]
            current_page=issues.current_page, # [!code ++]
            last_page=issues.last_page, # [!code ++]
        ) # [!code ++]
```

`when(condition, callback)` adds the callback's conditions only when the condition is truthy. Each filter is one line, and a filter the client didn't send adds nothing to the query.

`paginate()` runs the query for one page and counts the matching rows, so the response can say how many pages there are. The page size is the `ISSUES_PER_PAGE` setting you added in lesson 3, so you can change it without touching code.

## Check

In-progress issues in `WEB`:

```bash
curl "http://127.0.0.1:8000/api/projects/1/issues?status=in_progress"
```

```json
{
  "data": [
    {"id": 1, "key": "WEB-1", "title": "Homepage hero image is blurry", "status": "in_progress", "priority": "high", ...}
  ],
  "total": 1,
  "current_page": 1,
  "last_page": 1
}
```

Try the other filters. The `data` keys you get back are:

| Query string | Issues |
|---|---|
| *(none)* | `WEB-5`, `WEB-4`, `WEB-3`, `WEB-2`, `WEB-1` |
| `?status=todo&status=in_progress&sort=number` | `WEB-1`, `WEB-2`, `WEB-5` |
| `?priority=urgent&priority=high` | `WEB-3`, `WEB-1` |
| `?assignee_id=1` | `WEB-3` |
| `?unassigned=1` | `WEB-5`, `WEB-2` |
| `?q=page` | `WEB-5`, `WEB-2`, `WEB-1` |

The search for `page` finds "Homepage", "pricing page" and "homepage". `like` doesn't care about case in SQLite.

Bad filters come back as a `422`. Errors on a list name the position of the bad value, like `status.0`:

```bash
curl -H "Accept: application/json" \
  "http://127.0.0.1:8000/api/projects/1/issues?status=closed&sort=title&page=0"
```

```json
{
  "message": "Input should be 'todo', 'in_progress', 'in_review' or 'done' (and 2 more errors)",
  "errors": {
    "status.0": ["Input should be 'todo', 'in_progress', 'in_review' or 'done'"],
    "sort": ["The selected sort is invalid."],
    "page": ["The page field must be at least 1."]
  }
}
```

::: info Why the Accept header?
When a `GET` fails validation, the framework assumes a browser sent it and redirects back with a `303`. `Accept: application/json` tells it you want the errors as JSON instead. Requests with a JSON body are treated as API calls already.
:::

To see more than one page, set `ISSUES_PER_PAGE=2` in `.env` and restart the server. `?page=2` then returns `WEB-3` and `WEB-2` with `"total": 5, "current_page": 2, "last_page": 3`. Set it back to `20` when you're done.
