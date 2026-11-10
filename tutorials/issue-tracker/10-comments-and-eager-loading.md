---
lesson: 10
title: Comments and eager loading
description: Add comments to issues, and load an issue with its comments and their authors in a fixed number of queries.
duration: 8
---

# Comments and eager loading

**Goal:** discuss an issue in comments, and fetch the issue with the whole thread.

## 1. Create the table

```bash
uv run python artisan db:make:migration create_comments_table --create comments
```

```python
from fastapi_startkit.masoniteorm import Migration


class CreateCommentsTable(Migration):
    async def up(self):
        async with await self.schema.create("comments") as table:
            table.increments("id")
            table.integer("issue_id").unsigned() # [!code ++]
            table.foreign("issue_id").references("id").on("issues").on_delete("cascade") # [!code ++]
            table.integer("author_id").unsigned() # [!code ++]
            table.foreign("author_id").references("id").on("users") # [!code ++]
            table.text("body") # [!code ++]
            table.timestamps()

    async def down(self):
        await self.schema.drop("comments")
```

```bash
uv run python artisan db:migrate
```

## 2. Add the model

Create `app/models/comment.py`:

```python
from typing import TYPE_CHECKING

from fastapi_startkit.masoniteorm.models import Model
from fastapi_startkit.masoniteorm.relationships import BelongsTo

if TYPE_CHECKING:
    from app.models.user import User


class Comment(Model):
    id: int
    issue_id: int
    author_id: int
    body: str

    author = BelongsTo["User"](local_key="author_id", foreign_key="id")
```

And give `Issue` its comments in `app/models/issue.py`:

```python
from fastapi_startkit.masoniteorm.relationships import BelongsTo # [!code --]
from fastapi_startkit.masoniteorm.relationships import BelongsTo, HasMany # [!code ++]

from app.enums import IssuePriority, IssueStatus

if TYPE_CHECKING:
    from app.models.comment import Comment # [!code ++]
    from app.models.project import Project
    from app.models.user import User


class Issue(Model):
    ...
    assignee = BelongsTo["User"](local_key="assignee_id", foreign_key="id")
    comments = HasMany["Comment"](local_key="id", foreign_key="issue_id") # [!code ++]
```

## 3. Validate and shape comments

Create `app/http/requests/comment.py`:

```python
from typing import Annotated

from fastapi_startkit.validation import Field, FormRequest


class StoreCommentRequest(FormRequest):
    author_id: Annotated[int, Field().required().exists("users", "id")]
    body: Annotated[str, Field().required().max(5000)]
```

And `app/http/resources/comment.py`:

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.http.resources.user import UserResource


class CommentResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    body: str
    author: UserResource
    created_at: datetime
```

The issue list stays small, but a single issue should come with its thread. Add a detail resource to `app/http/resources/issue.py`:

```python
from app.enums import IssuePriority, IssueStatus
from app.http.resources.comment import CommentResource # [!code ++]
from app.http.resources.user import UserResource

...


class IssueDetailResource(IssueResource): # [!code ++]
    comments: list[CommentResource] # [!code ++]
```

## 4. Add the controller

Create `app/http/controllers/comment_controller.py`:

```python
from fastapi import Response
from fastapi_startkit.validation import Validated

from app.http.requests.comment import StoreCommentRequest
from app.http.resources.comment import CommentResource
from app.models.comment import Comment
from app.models.issue import Issue


class CommentController:
    async def index(self, issue: int) -> list[CommentResource]:
        found = await Issue.find_or_fail(issue)
        comments = await Comment.with_("author").where("issue_id", found.id).order_by("id").get()
        return [CommentResource.model_validate(comment) for comment in comments]

    async def store(self, issue: int, request: Validated[StoreCommentRequest], response: Response) -> CommentResource:
        found = await Issue.find_or_fail(issue)
        comment = await Comment.create({**request.model_dump(), "issue_id": found.id})
        await comment.load("author")
        response.status_code = 201
        return CommentResource.model_validate(comment)
```

## 5. Load related rows up front

Relationships aren't loaded until you ask for them. There are two ways to ask:

```python
comments = await Comment.with_("author").where("issue_id", 1).get()

comment = await Comment.find_or_fail(1)
await comment.load("author")
```

`with_()` goes on a query. It loads the authors for every comment it finds in one extra query, whether there are 2 comments or 200. `load()` does the same for a model you already have.

Reading `comment.author` without loading it first raises a `LazyLoadingViolation`. That's on purpose. Loading it quietly would turn a loop over 200 comments into 200 extra queries, and you wouldn't notice until the page got slow.

## 6. Load the thread with the issue

Change `show()` in `IssueController` to return the detail resource:

```python
from app.http.resources.issue import IssueResource # [!code --]
from app.http.resources.issue import IssueDetailResource, IssueResource # [!code ++]

class IssueController:
    ...

    async def show(self, issue: int) -> IssueResource: # [!code --]
        found = await Issue.find_or_fail(issue) # [!code --]
        await found.load("reporter", "assignee") # [!code --]
        return IssueResource.model_validate(found) # [!code --]
    async def show(self, issue: int) -> IssueDetailResource: # [!code ++]
        found = await Issue.with_("reporter", "assignee", "comments.author").find_or_fail(issue) # [!code ++]
        return IssueDetailResource.model_validate(found) # [!code ++]
```

`"comments.author"` is a nested path. It loads the issue's comments and then the author of each comment, with one query per level however long the thread is.

::: tip Nested paths need with_()
Use `with_()` on the query for nested paths like `comments.author`. `load()` on a model you already have takes plain relationship names, such as `load("reporter", "assignee")`.
:::

## 7. Add the routes

In `routes/api.py`:

```python
from app.http.controllers.comment_controller import CommentController # [!code ++]
from app.http.controllers.home_controller import HomeController
...

issues = IssueController()
comments = CommentController() # [!code ++]

...
api.post("/issues/{issue}/transitions", issues.transition)
api.get("/issues/{issue}/comments", comments.index) # [!code ++]
api.post("/issues/{issue}/comments", comments.store) # [!code ++]
```

## Check

Start from a clean database with one issue:

```bash
uv run python artisan db:migrate:fresh
uv run python artisan db:seed
curl -X POST http://127.0.0.1:8000/api/projects/1/issues \
  -H "Content-Type: application/json" \
  -d '{"title": "Homepage hero image is blurry", "reporter_id": 1}'
```

Comment on it:

```bash
curl -X POST http://127.0.0.1:8000/api/issues/1/comments \
  -H "Content-Type: application/json" \
  -d '{"author_id": 2, "body": "I can reproduce this on Safari."}'
```

```json
{
  "id": 1,
  "body": "I can reproduce this on Safari.",
  "author": {"id": 2, "name": "Grace Hopper", "email": "grace@example.com"},
  "created_at": "2026-11-06T19:10:39.707099Z"
}
```

Add a reply from Ada, with `"author_id": 1`, then fetch the issue. The thread comes with it, each comment with its author:

```bash
curl http://127.0.0.1:8000/api/issues/1
```

```json
{
  "id": 1,
  "key": "WEB-1",
  "title": "Homepage hero image is blurry",
  ...
  "comments": [
    {"id": 1, "body": "I can reproduce this on Safari.", "author": {"id": 2, "name": "Grace Hopper", ...}, ...},
    {"id": 2, "body": "Thanks, swapping in a sharper image.", "author": {"id": 1, "name": "Ada Lovelace", ...}, ...}
  ],
  "transitions": ["in_progress"]
}
```

An unknown author and an empty body are refused:

```json
{
  "message": "The selected author id is invalid. (and 1 more error)",
  "errors": {
    "author_id": ["The selected author id is invalid."],
    "body": ["The body field is required."]
  }
}
```
