---
lesson: 1
title: What are we building?
description: Meet Task Manager, the app you'll build, and the few ideas the whole course rests on.
duration: 3
---

# What are we building?

**Goal:** know what you're going to build and the three ideas you'll use in every lesson.

## Task Manager

By the end of this course you'll have an app called Task Manager. Tasks belong to projects. You can manage them through a JSON API:

```bash
curl -X POST http://127.0.0.1:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1, "title": "Write the launch post"}'
```

```json
{
  "id": 4,
  "project_id": 1,
  "title": "Write the launch post",
  "description": null,
  "completed": false,
  "created_at": "2026-10-29T08:39:50.204098Z"
}
```

You can also use a Vue page at `/tasks`, where you add tasks, tick them off and delete them without the page reloading.

## Three ideas

You only need three ideas to follow along.

**The application is built from providers.** `bootstrap/application.py` creates one `Application` and gives it a list of providers. Each provider switches on a feature, such as logging, FastAPI or the database. Adding a feature usually means adding a provider to that list.

**Configuration is a dataclass.** Settings live in small dataclasses under `config/`. Each field reads its value from the environment with `env()`, so you change behaviour in `.env` instead of in code.

**`artisan` does the chores.** `uv run python artisan` is the project's command line. It starts the server, creates files for you and runs your migrations and seeders.

## The plan

| Lesson | You'll add |
|---|---|
| 2 | A new project, running on your machine |
| 3 | A tour of the project and your first config value |
| 4 | A route and a controller |
| 5 | A SQLite database with two tables |
| 6 | `Project` and `Task` models |
| 7 | Seeders with some sample data |
| 8 | Create, read, update and delete, with validation |
| 9 | Relationships, eager loading and pagination |
| 10 | A Vue page with Inertia |
| 11 | Tests |
| 12 | Where to go next |

## Check

Nothing to run yet. If you can say where providers are registered and where settings come from, you're ready for the next lesson.
