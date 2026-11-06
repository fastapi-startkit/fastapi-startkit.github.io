---
lesson: 7
title: Assignees and priorities
description: Assign and unassign issues and change their priority with a partial update.
duration: 5
---

# Assignees and priorities

**Goal:** hand an issue to someone, raise its priority and take it back off their plate.

## 1. Describe the update

Add a request to `app/http/requests/issue.py`, between the other two:

```python
class UpdateIssueRequest(FormRequest): # [!code ++]
    priority: IssuePriority = IssuePriority.MEDIUM # [!code ++]
    assignee_id: Annotated[int | None, Field().nullable().exists("users", "id")] = None # [!code ++]
```

Status isn't here on purpose. It only changes through `/transitions`, so the workflow can't be skipped with a `PATCH`.

`assignee_id` is `nullable()`, so sending `null` is how you unassign an issue. `priority` isn't, so `"priority": null` is refused.

## 2. Add the controller method

In `app/http/controllers/issue_controller.py`:

```python
from app.http.requests.issue import StoreIssueRequest, TransitionIssueRequest # [!code --]
from app.http.requests.issue import StoreIssueRequest, TransitionIssueRequest, UpdateIssueRequest # [!code ++]

class IssueController:
    ...

    async def update(self, issue: int, request: Validated[UpdateIssueRequest]) -> IssueResource: # [!code ++]
        found = await Issue.find_or_fail(issue) # [!code ++]
        await found.update(request.model_dump(exclude_unset=True)) # [!code ++]
        await found.load("reporter", "assignee") # [!code ++]
        return IssueResource.model_validate(found) # [!code ++]
```

`exclude_unset=True` keeps only the fields the client sent. Without it, a request that only changes the priority would also fill in the default `assignee_id` and unassign the issue.

## 3. Add the route

`PATCH` is the method for changing part of a record. In `routes/api.py`:

```python
api.get("/issues/{issue}", issues.show)
api.patch("/issues/{issue}", issues.update) # [!code ++]
api.post("/issues/{issue}/transitions", issues.transition)
```

## Check

Assign issue 1 to Alan:

```bash
curl -X PATCH http://127.0.0.1:8000/api/issues/1 \
  -H "Content-Type: application/json" \
  -d '{"assignee_id": 3}'
```

```json
{"id": 1, "key": "WEB-1", "priority": "medium", "assignee": {"id": 3, "name": "Alan Turing", "email": "alan@example.com"}, ...}
```

Raise its priority. The assignee stays as it was:

```bash
curl -X PATCH http://127.0.0.1:8000/api/issues/1 \
  -H "Content-Type: application/json" \
  -d '{"priority": "urgent"}'
```

```json
{"id": 1, "key": "WEB-1", "priority": "urgent", "assignee": {"id": 3, "name": "Alan Turing", "email": "alan@example.com"}, ...}
```

Send `{"assignee_id": null}` and the response has `"assignee": null`. Bad values are refused as before:

```bash
curl -X PATCH http://127.0.0.1:8000/api/issues/1 \
  -H "Content-Type: application/json" \
  -d '{"priority": "whenever", "assignee_id": 99}'
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
