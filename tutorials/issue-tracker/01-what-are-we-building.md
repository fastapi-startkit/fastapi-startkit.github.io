---
lesson: 1
title: What are we building?
description: Meet Issue Tracker, its data model and the workflow every issue follows.
duration: 4
---

# What are we building?

**Goal:** know what you're going to build, how its data fits together and which status changes are allowed.

## Issue Tracker

By the end of this course you'll have an API that works like a small Jira. You create an issue in a project and it gets the next key for that project:

```bash
curl -X POST http://127.0.0.1:8000/api/projects/1/issues \
  -H "Content-Type: application/json" \
  -d '{"title": "Add a pricing page", "reporter_id": 2}'
```

```json
{
  "id": 2,
  "key": "WEB-2",
  "title": "Add a pricing page",
  "description": null,
  "status": "todo",
  "priority": "medium",
  "reporter": {"id": 2, "name": "Grace Hopper", "email": "grace@example.com"},
  "assignee": null,
  "created_at": "2026-11-06T19:10:12.657042Z",
  "transitions": ["in_progress"]
}
```

`transitions` lists the statuses the issue can move to next. The API refuses any other move.

## The data

Four tables hold everything:

| Table | Holds | Belongs to |
|---|---|---|
| `users` | The people who report, work on and discuss issues | |
| `projects` | A name and a short `key`, such as `WEB` | |
| `issues` | A title, status, priority and a key like `WEB-1` | a project, a reporter and maybe an assignee |
| `comments` | A message on an issue | an issue and an author |

There's no login in this course. Requests say who's acting with fields like `reporter_id` and `author_id`, so you can focus on the issue tracker itself.

## The workflow

Every issue starts in **To Do**. From there it can only move along these arrows:

| From | Can move to |
|---|---|
| To Do | In Progress |
| In Progress | To Do, In Review |
| In Review | In Progress, Done |
| Done | To Do |

So you can't jump straight from To Do to Done, and a finished issue goes back to To Do if it needs reopening.

## The plan

| Lesson | You'll add |
|---|---|
| 2 | A new project with a SQLite database |
| 3 | Users and projects: migrations, models and seeders |
| 4 | An API for projects, with validation rules |
| 5 | Issues with keys, priorities, reporters and assignees |
| 6 | The status workflow |
| 7 | Assigning issues and changing their priority |
| 8 | Comments |
| 9 | Filters, search, sorting and pagination |
| 10 | Tests |
| 11 | Where to go next |

## Check

Nothing to run yet. If you can say which status a new issue starts in, and why `todo` to `done` is refused, you're ready for the next lesson.
