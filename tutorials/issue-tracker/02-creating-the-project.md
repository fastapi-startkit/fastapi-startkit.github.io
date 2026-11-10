---
lesson: 2
title: Creating the project
description: Create a new FastAPI Startkit app with a SQLite database and a Vue frontend, then start the development server.
duration: 5
---

# Creating the project

**Goal:** a new app with a database, running on your machine.

## 1. Run the installer

The installer creates a project for you. Run it without any options and it asks a few questions:

```bash
uvx fastapi-startkit@latest init issue-tracker
```

Answer them like this:

| Question | Answer |
|---|---|
| Which services should your application run? | Web |
| Which database will your application use? | SQLite |
| Which frontend would you like to install? | Vue |

If you'd rather skip the questions, pass the answers as options. `-n` turns off the questions:

```bash
uvx fastapi-startkit@latest init issue-tracker --app=web --database=sqlite --frontend=vue -n
```

::: tip No uv yet?
On macOS or Linux, the install script sets up uv for you and runs the same installer:

```bash
curl -fsSL https://fastapi-startkit.github.io/install.sh | bash -s -- issue-tracker --app=web --database=sqlite --frontend=vue -n
```
:::

The installer prints each file it creates and then installs the Python packages:

```
Application: web; database: sqlite; frontend: vue
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
  create vite.config.ts
Dependency: fastapi-startkit[database,fastapi,inertia,sqlite,vite]==0.75.1
...
Your application is ready.
```

Choosing SQLite gave you three things:

- `config/database.py`, which reads its settings from `.env`,
- `DB_CONNECTION=sqlite` and `DB_DATABASE=databases/database.sqlite` in `.env`,
- a `databases/` folder for migrations and seeders.

Choosing Vue gave you Vite, Tailwind, Inertia and a first page in `resources/js/Pages/Home.vue`. You'll use them for the issue board in lesson 12.

::: tip Adding a database to an existing app
If you started without a database, [Database: Getting Started](/docs/database/) shows how to add one by hand.
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

Then open `http://127.0.0.1:8000/docs` in your browser. This is FastAPI's interactive API page. Every route you add in this course shows up here.

::: info The home page comes later
The page at `/` is a Vue page. It needs the frontend to be built first, which you'll do in [lesson 12](./12-an-issue-board-with-inertia). Until then, stick to `/health` and `/docs`.
:::
