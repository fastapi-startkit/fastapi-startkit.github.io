---
course: true
title: Build a Task Manager
description: Learn the framework from the ground up by building a task manager with routes, controllers, a database, models, seeders, relationships, an Inertia page and tests.
level: Beginner
order: 1
aside: false
---

# Build a Task Manager

In this course you'll build **Task Manager**, a small app for keeping track of projects and the tasks inside them. You'll start with an empty project and finish with an app that:

- serves a JSON API for tasks and projects,
- stores everything in a SQLite database,
- creates its tables with migrations and fills them with seeders,
- validates input and returns clear errors,
- loads related records and pages through long lists,
- has a Vue page, rendered with Inertia, where you add, finish and delete tasks,
- and has a test suite that runs against its own database.

Along the way you'll meet the main parts of FastAPI Startkit: the installer, `artisan`, configuration, providers, routers, controllers, the ORM and the testing helpers.

Every lesson builds on the one before it, so work through them in order. Each one ends with a quick check, so you always know your code works before you move on.

## What you need

- Python 3.12 or newer
- [uv](https://docs.astral.sh/uv/), to create the project and run commands
- [Node.js](https://nodejs.org/) 22.12 or newer, for the Vue page in lesson 10
- A way to send HTTP requests. The lessons use `curl`, but the built-in `/docs` page works just as well.
