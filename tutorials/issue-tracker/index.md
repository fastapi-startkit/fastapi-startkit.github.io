---
course: true
title: Build an Issue Tracker
description: Build a Jira-style issue tracker with projects, a status workflow, assignees, priorities, comments, filters and tests.
level: Intermediate
order: 3
aside: false
---

# Build an Issue Tracker

In this course you'll build **Issue Tracker**, a small Jira-style API for teams. You'll start with an empty project and finish with an app that:

- groups issues into projects, each with a short key like `WEB`,
- numbers issues per project, so they get keys like `WEB-1` and `WEB-2`,
- moves issues through a workflow: To Do, In Progress, In Review, Done,
- turns away moves the workflow doesn't allow,
- assigns issues to people and sets their priority,
- keeps a thread of comments on every issue,
- filters, searches, sorts and pages through a project's issues,
- and has a test suite that runs against its own database.

Along the way you'll use FastAPI Startkit's validation rules, ORM relationships, eager loading, query builder, routers and config classes.

Every lesson builds on the one before it, so work through them in order. Each one ends with a quick check, so you always know your code works before you move on.

## The finished app

The whole app is on GitHub at [fastapi-startkit/issue-tracker](https://github.com/fastapi-startkit/issue-tracker). Each lesson is one commit, tagged `lesson-02` to `lesson-10`. If you get stuck, each lesson links to its tag and to the exact changes it makes.

## What you need

- Python 3.12 or newer
- [uv](https://docs.astral.sh/uv/), to create the project and run commands
- A way to send HTTP requests. The lessons use `curl`, but the built-in `/docs` page works just as well.

If you're new to FastAPI Startkit, [Build a Task Manager](/tutorials/task-manager/) covers the basics this course builds on.
