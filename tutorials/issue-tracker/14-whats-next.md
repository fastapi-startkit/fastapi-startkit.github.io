---
lesson: 14
title: What's next?
description: Recap what you built and pick where to take your issue tracker next.
duration: 3
---

# What's next?

**Goal:** know what you've built and where to take it next.

## What you built

Issue Tracker now:

- reads its settings from `.env` through a config dataclass,
- serves a JSON API built with `Router` and `resource()`,
- stores users, projects, issues and comments in SQLite, with tables made by migrations and sample data from seeders,
- groups issues into projects and gives each one a key like `WEB-1`,
- checks every request with `FormRequest` rules, including `exists()` lookups in the database,
- moves issues through a workflow that lives in one map and is enforced by an `after()` hook,
- edits and deletes issues, with a partial `PATCH` that only touches the fields you send,
- loads an issue with its reporter, assignee, comments and comment authors in a fixed number of queries,
- filters, searches, sorts and pages through issues from a validated query string,
- shows a project board in Vue, rendered with Inertia, that uses the same models and rules as the API,
- and has tests that prove those rules against their own database.

Those pieces are most of what a real app needs. The rest builds on the same ideas: a provider to switch a feature on, a config class to set it up and `artisan` to do the chores.

## Ideas to try

- **Edit projects.** Give `ProjectController` `update` and `destroy` methods and add them to `only=`.
- **Labels.** Add a `labels` table and an `issue_label` table, use `BelongsToMany` on `Issue`, and add a `?label=bug` filter.
- **A "Blocked" status.** Add it to `IssueStatus`, to `WORKFLOW` and to the board's `columns`. Your workflow test still guards the old paths.
- **Comments on the board.** Open an issue in a side panel that shows its thread, and add a form to reply.
- **Activity history.** Write a row to an `issue_events` table on every transition and assignment, and return it with the issue.
- **Who's acting.** Replace `reporter_id` and `author_id` in request bodies with the logged-in user. The separate `fastapi-startkit-auth` package adds sign up, log in and protected routes.
- **Switch databases.** Point `DB_CONNECTION` at PostgreSQL or MySQL and install the matching extra. Your models don't change. The [database docs](/docs/database/) show the settings.

## Keep reading

- [Configuration](/docs/configuration) covers `env()`, environment files and config classes.
- [FastAPI](/docs/fastapi) covers routers, `resource()` and its options.
- [Migrations](/docs/database/migrations), [Models](/docs/database/models), [Relationships](/docs/database/relationships) and [Seeding](/docs/database/seeds) go deeper into the ORM.
- [Casts](/docs/database/casts) covers how columns are turned into Python values.
- [Inertia](/docs/frontend/inertia) covers shared data, redirects, flash data and validation errors.
- [HTTP tests](/docs/testing/fastapi) and [database tests](/docs/testing/database) list every assertion.
