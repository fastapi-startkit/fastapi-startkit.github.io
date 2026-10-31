---
lesson: 12
title: What's next?
description: Recap what you built and pick where to go from here.
duration: 3
---

# What's next?

**Goal:** know what you've built and where to take it next.

## What you built

Task Manager now:

- reads its settings from `.env` through a config dataclass,
- serves a JSON API built with `Router` and `resource()`,
- stores projects and tasks in SQLite, with tables made by migrations,
- fills itself with sample data from seeders,
- validates input and answers with `201`, `204`, `404` and `422` where they fit,
- loads projects with their tasks and pages through long lists,
- has a Vue page rendered with Inertia,
- and has tests that run against their own database.

Those pieces are most of what a real app needs. The rest builds on the same ideas: a provider to switch a feature on, a config class to set it up and `artisan` to do the chores.

## Ideas to try

- **Edit projects.** Give `ProjectController` the `store`, `update` and `destroy` methods and drop `only=` from its route.
- **Add a due date.** Write a migration with `db:make:migration add_due_date_to_tasks --table tasks`, add the field to `Task` and show it on the page.
- **Filter tasks.** Add a `completed: bool | None = None` argument to `index()` and use `where("completed", completed)` when it's set.
- **Switch databases.** Point `DB_CONNECTION` at PostgreSQL or MySQL and install the matching extra. Your models don't change. The [database docs](/docs/database/) show the settings.
- **Add users.** The separate `fastapi-startkit-auth` package adds sign up, log in and protected routes.

## Keep reading

- [Configuration](/docs/configuration) covers `env()`, environment files and config classes in detail.
- [FastAPI](/docs/fastapi) covers routers, `resource()` and its options.
- [Database](/docs/database/), [Migrations](/docs/database/migrations), [Models](/docs/database/models), [Relationships](/docs/database/relationships) and [Seeding](/docs/database/seeds) go deeper into the ORM.
- [Inertia](/docs/frontend/inertia) covers shared data, redirects, flash data and validation errors.
- [HTTP tests](/docs/testing/fastapi) and [database tests](/docs/testing/database) list every assertion.
- [Build an AI Agent](/tutorials/ai-agents/) is the next course. It adds an AI assistant to a FastAPI Startkit app.
