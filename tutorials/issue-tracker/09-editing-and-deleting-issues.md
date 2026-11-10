---
lesson: 9
title: Editing and deleting issues
description: Change an issue's title, description, priority and assignee with a partial update, and delete issues.
duration: 7
---

# Editing and deleting issues

**Goal:** rename an issue, hand it to someone, raise its priority and delete it when it's no longer needed.

## 1. Describe the update

Add a request to `app/http/requests/issue.py`, between the other two:

```python
from typing import Annotated

from fastapi_startkit.validation import Field, FormRequest, Validator
from pydantic import StringConstraints # [!code ++]

...


class UpdateIssueRequest(FormRequest): # [!code ++]
    title: Annotated[str, StringConstraints(min_length=1, max_length=255)] = "" # [!code ++]
    description: str | None = None # [!code ++]
    priority: IssuePriority = IssuePriority.MEDIUM # [!code ++]
    assignee_id: Annotated[int | None, Field().nullable().exists("users", "id")] = None # [!code ++]
```

Every field has a default, so a client can send just the fields it wants to change.

Status isn't here on purpose. It only changes through `/transitions`, so the workflow can't be skipped with a `PATCH`.

A few rules are worth a closer look:

- `title` is optional here, but when it's sent it can't be empty. `Field()` rules skip empty values unless the field is `required()`, so `Field().min(1)` would let `""` through. `StringConstraints` comes from pydantic and checks every value it's given.
- `assignee_id` is `nullable()`, so sending `null` is how you unassign an issue.
- `priority` isn't nullable, so `"priority": null` is refused.

## 2. Add the controller methods

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
# [!code ++]
    async def destroy(self, issue: int, response: Response) -> None: # [!code ++]
        found = await Issue.find_or_fail(issue) # [!code ++]
        await found.delete() # [!code ++]
        response.status_code = 204 # [!code ++]
```

`exclude_unset=True` keeps only the fields the client sent. Without it, a request that only changes the priority would also fill in the default `title` and `assignee_id`, which would clear the title and unassign the issue.

`delete()` removes the row. `204` means it worked and there's nothing to send back.

## 3. Add the routes

`PATCH` is the method for changing part of a record, and `DELETE` removes one. In `routes/api.py`:

```python
api.get("/issues/{issue}", issues.show)
api.patch("/issues/{issue}", issues.update) # [!code ++]
api.delete("/issues/{issue}", issues.destroy) # [!code ++]
api.post("/issues/{issue}/transitions", issues.transition)
```

## Check

Rename issue 1 and give it a description:

```bash
curl -X PATCH http://127.0.0.1:8000/api/issues/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "Add a pricing page for teams", "description": "Monthly and yearly plans."}'
```

```json
{"id": 1, "key": "WEB-1", "title": "Add a pricing page for teams", "description": "Monthly and yearly plans.", "priority": "medium", "assignee": null, ...}
```

Assign it to Alan and raise its priority. The title stays as it was:

```bash
curl -X PATCH http://127.0.0.1:8000/api/issues/1 \
  -H "Content-Type: application/json" \
  -d '{"assignee_id": 3, "priority": "urgent"}'
```

```json
{"id": 1, "key": "WEB-1", "title": "Add a pricing page for teams", "priority": "urgent", "assignee": {"id": 3, "name": "Alan Turing", "email": "alan@example.com"}, ...}
```

Send `{"assignee_id": null}` and the response has `"assignee": null`. An empty title is refused:

```bash
curl -X PATCH http://127.0.0.1:8000/api/issues/1 \
  -H "Content-Type: application/json" \
  -d '{"title": ""}'
```

```json
{"message": "String should have at least 1 character", "errors": {"title": ["String should have at least 1 character"]}}
```

File a throwaway issue and delete it. Use the `id` from the first response:

```bash
curl -X POST http://127.0.0.1:8000/api/projects/1/issues \
  -H "Content-Type: application/json" \
  -d '{"title": "Typo", "reporter_id": 1}'

curl -i -X DELETE http://127.0.0.1:8000/api/issues/2
```

The delete answers `HTTP/1.1 204 No Content`. Ask for the issue again and you get a `404`.
