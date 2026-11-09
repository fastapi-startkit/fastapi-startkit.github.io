---
lesson: 6
title: The status workflow
description: Move issues between statuses, and use a validation hook to refuse moves the workflow doesn't allow.
duration: 8
---

# The status workflow

**Goal:** move an issue from To Do to Done one step at a time, with every skipped step refused.

## 1. Write the workflow down

The workflow from [lesson 1](./01-what-are-we-building#the-workflow) is a map from each status to the statuses it can move to. Put it next to the enum in `app/enums.py`, and give `IssueStatus` two methods that read it:

```python
from enum import StrEnum


class IssueStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"

    def transitions(self) -> list["IssueStatus"]: # [!code ++]
        return WORKFLOW[self] # [!code ++]
# [!code ++]
    def can_move_to(self, status: "IssueStatus") -> bool: # [!code ++]
        return status in self.transitions() # [!code ++]
# [!code ++]
# [!code ++]
WORKFLOW = { # [!code ++]
    IssueStatus.TODO: [IssueStatus.IN_PROGRESS], # [!code ++]
    IssueStatus.IN_PROGRESS: [IssueStatus.TODO, IssueStatus.IN_REVIEW], # [!code ++]
    IssueStatus.IN_REVIEW: [IssueStatus.IN_PROGRESS, IssueStatus.DONE], # [!code ++]
    IssueStatus.DONE: [IssueStatus.TODO], # [!code ++]
} # [!code ++]
```

The rules live in one place. To add a "Blocked" status later, you add it to the enum and to this map.

## 2. Check the move while validating

Field rules check one value at a time. Whether a move is allowed depends on the issue's current status in the database, so it needs an `after()` hook. It runs once the field rules have passed and can add its own errors. Add a request to `app/http/requests/issue.py`:

```python
from typing import Annotated

from fastapi_startkit.validation import Field, FormRequest # [!code --]
from fastapi_startkit.validation import Field, FormRequest, Validator # [!code ++]

from app.enums import IssuePriority # [!code --]
from app.enums import IssuePriority, IssueStatus # [!code ++]
from app.models.issue import Issue # [!code ++]


class StoreIssueRequest(FormRequest):
    ...


class TransitionIssueRequest(FormRequest): # [!code ++]
    status: IssueStatus # [!code ++]
# [!code ++]
    @classmethod # [!code ++]
    async def after(cls, validator: Validator) -> None: # [!code ++]
        issue = await Issue.find(validator.context["issue"]) # [!code ++]
        status = validator.data.get("status") # [!code ++]
        if issue is None or validator.errors.has("status"): # [!code ++]
            return # [!code ++]
        if not issue.status.can_move_to(status): # [!code ++]
            validator.errors.add("status", f"An issue in {issue.status} can't move to {status}.") # [!code ++]
```

The validator gives the hook what it needs:

- `validator.context` holds the path parameters, so `context["issue"]` is the `{issue}` in the URL, already turned into an `int`.
- `validator.data` is the body that passed the field rules.
- `validator.errors` collects errors. Anything you `add()` comes back in the same `422` shape as the field rules.

The hook returns early when the issue doesn't exist, so the controller's `find_or_fail()` can answer with a `404`. It also returns early when `status` already failed, such as `"closed"`, so the client sees one clear error.

## 3. Show the next steps

Clients need to know which buttons to show. A computed field adds `transitions` to every issue the API returns. In `app/http/resources/issue.py`:

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict # [!code --]
from pydantic import BaseModel, ConfigDict, computed_field # [!code ++]

from app.enums import IssuePriority, IssueStatus
from app.http.resources.user import UserResource


class IssueResource(BaseModel):
    ...
    assignee: UserResource | None
    created_at: datetime

    @computed_field # [!code ++]
    @property # [!code ++]
    def transitions(self) -> list[IssueStatus]: # [!code ++]
        return self.status.transitions() # [!code ++]
```

## 4. Add the endpoint

A move is an action on an issue, so it gets its own route instead of being a field you can edit. Add a method to `IssueController`:

```python
from app.http.requests.issue import StoreIssueRequest # [!code --]
from app.http.requests.issue import StoreIssueRequest, TransitionIssueRequest # [!code ++]

class IssueController:
    ...

    async def transition(self, issue: int, request: Validated[TransitionIssueRequest]) -> IssueResource: # [!code ++]
        found = await Issue.find_or_fail(issue) # [!code ++]
        await found.update({"status": request.status}) # [!code ++]
        await found.load("reporter", "assignee") # [!code ++]
        return IssueResource.model_validate(found) # [!code ++]
```

And its route in `routes/api.py`:

```python
api.get("/issues/{issue}", issues.show)
api.post("/issues/{issue}/transitions", issues.transition) # [!code ++]
```

## Check

Start from a clean database with one new issue:

```bash
uv run python artisan db:migrate:fresh
uv run python artisan db:seed
curl -X POST http://127.0.0.1:8000/api/projects/1/issues \
  -H "Content-Type: application/json" \
  -d '{"title": "Add a pricing page", "reporter_id": 2}'
```

The response now ends with `"transitions": ["in_progress"]`. Try to skip ahead to Done:

```bash
curl -X POST http://127.0.0.1:8000/api/issues/1/transitions \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

```json
{"message": "An issue in todo can't move to done.", "errors": {"status": ["An issue in todo can't move to done."]}}
```

Now take the allowed path. Each response shows the new status and the next moves:

```bash
curl -X POST http://127.0.0.1:8000/api/issues/1/transitions \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

```json
{"id": 1, "key": "WEB-1", "status": "in_progress", "transitions": ["todo", "in_review"], ...}
```

Send `in_review` and then `done`, and the issue ends with `"status": "done"` and `"transitions": ["todo"]`.

A status that isn't in the enum is caught by the field rule:

```json
{"message": "Input should be 'todo', 'in_progress', 'in_review' or 'done'", "errors": {"status": ["Input should be 'todo', 'in_progress', 'in_review' or 'done'"]}}
```

::: info Compare your code
This lesson's code is tagged [`lesson-06`](https://github.com/fastapi-startkit/issue-tracker/tree/lesson-06). See [the changes in this lesson](https://github.com/fastapi-startkit/issue-tracker/compare/lesson-05...lesson-06).
:::
