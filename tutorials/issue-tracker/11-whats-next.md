---
lesson: 11
title: What's next?
description: Recap what you built and pick where to take your issue tracker next.
duration: 3
---

# What's next?

**Goal:** know what you've built and where to take it next.

## What you built

Issue Tracker now:

- groups issues into projects and gives each one a key like `WEB-1`,
- checks every request with `FormRequest` rules, including `unique()` and `exists()` lookups in the database,
- moves issues through a workflow that lives in one map and is enforced by an `after()` hook,
- assigns, unassigns and reprioritises issues with a partial `PATCH`,
- loads an issue with its reporter, assignee, comments and comment authors in a few queries,
- filters, searches, sorts and pages through issues from a validated query string,
- and has tests that prove those rules against their own database.

The finished code is in [fastapi-startkit/issue-tracker](https://github.com/fastapi-startkit/issue-tracker).

## Ideas to try

- **Edit titles and descriptions.** Add `title` and `description` to `UpdateIssueRequest`. Make `title` refuse `null`, so a `PATCH` can't blank it.
- **Labels.** Add a `labels` table and an `issue_label` table, use `BelongsToMany` on `Issue`, and add a `?label=bug` filter.
- **A "Blocked" status.** Add it to `IssueStatus` and to `WORKFLOW`. Nothing else has to change, and your workflow test still guards the old paths.
- **Activity history.** Write a row to an `issue_events` table on every transition and assignment, and return it with the issue.
- **Who's acting.** Replace `reporter_id` and `author_id` in request bodies with the logged-in user. The separate `fastapi-startkit-auth` package adds sign up, log in and protected routes.
- **A board.** Add an endpoint that groups a project's issues by status, ready for a Kanban view.

## Keep reading

- [Migrations](/docs/database/migrations), [Models](/docs/database/models), [Relationships](/docs/database/relationships) and [Seeding](/docs/database/seeds) go deeper into the ORM.
- [Casts](/docs/database/casts) covers how columns are turned into Python values.
- [FastAPI](/docs/fastapi) covers routers, `resource()` and its options.
- [Configuration](/docs/configuration) covers `env()`, environment files and config classes.
- [HTTP tests](/docs/testing/fastapi) and [database tests](/docs/testing/database) list every assertion.
- [Build an AI Agent](/tutorials/ai-agents/) adds an AI assistant to a FastAPI Startkit app.
