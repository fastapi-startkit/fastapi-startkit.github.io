---
course: true
title: Build an Issue Tracker
description: Learn FastAPI Startkit by building a Jira-style issue tracker with projects, a status workflow, comments, filters, a Vue board and tests.
level: Beginner
order: 1
aside: false
---

# Build an Issue Tracker

In this course you'll build **Issue Tracker**, a small Jira-style app for teams. You'll start with an empty project and finish with an app that:

- groups issues into projects, each with a short key like `WEB`,
- numbers issues per project, so they get keys like `WEB-1` and `WEB-2`,
- moves issues through a workflow: To Do, In Progress, In Review, Done,
- turns away moves the workflow doesn't allow,
- lets you edit, assign, reprioritise and delete issues,
- keeps a thread of comments on every issue,
- filters, searches, sorts and pages through a project's issues,
- shows each project as a board in Vue, where you add issues and move them between columns,
- and has a test suite that runs against its own database.

Along the way you'll learn how a FastAPI Startkit app fits together: providers and config classes, routers and controllers, migrations, models and seeders, validation rules, relationships, Inertia pages and tests.

You don't need to know the framework already. Every lesson builds on the one before it, so work through them in order. Each one ends with a quick check, so you always know your code works before you move on.

## What you need

- Python 3.12 or newer
- [uv](https://docs.astral.sh/uv/), to create the project and run commands
- [Node.js](https://nodejs.org/) 22.12 or newer, to build the Vue board in lesson 12
- A way to send HTTP requests. The lessons use `curl`, but the built-in `/docs` page works just as well.
