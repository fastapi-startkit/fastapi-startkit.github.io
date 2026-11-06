---
lesson: 2
title: Creating the project
description: Create a new FastAPI Startkit app with a SQLite database and start the development server.
duration: 4
---

# Creating the project

**Goal:** a new app with a database, running on your machine.

## 1. Run the installer

This time you'll ask the installer for a SQLite database straight away. Pass the answers as options, and `-n` turns off the questions:

```bash
uvx fastapi-startkit@latest init issue-tracker --app=web --database=sqlite --frontend=none -n
```

The installer prints each file it creates and then installs the Python packages:

```
Application: web; database: sqlite; frontend: none
  create .env
  create .env.example
  ...
  create config/database.py
  ...
  create databases/migrations/.gitkeep
  create databases/seeders/__init__.py
  create databases/seeders/database_seeder.py
  ...
  create routes/api.py
  create tests/test_application.py
Dependency: fastapi-startkit[database,fastapi,sqlite]==0.74.0
```

Choosing a database gave you three extra things:

- `config/database.py`, which reads its settings from `.env`,
- `DB_CONNECTION=sqlite` and `DB_DATABASE=databases/database.sqlite` in `.env`,
- a `databases/` folder for migrations and seeders.

::: tip Want to see how a database is added by hand?
[Build a Task Manager](/tutorials/task-manager/05-adding-a-database) starts without one and adds it step by step.
:::

## 2. Start the server

Move into the new folder and start the server:

```bash
cd issue-tracker
uv run python artisan serve
```

The app runs at `http://127.0.0.1:8000`. Leave it running in its own terminal. It reloads when you save a file.

## Check

Open a second terminal and ask the app if it's healthy:

```bash
curl http://127.0.0.1:8000/health
```

```json
{"status": "ok"}
```

Then open `http://127.0.0.1:8000/docs`. Every route you add in this course shows up here.

::: info Compare your code
This lesson's code is tagged [`lesson-02`](https://github.com/fastapi-startkit/issue-tracker/tree/lesson-02).
:::
