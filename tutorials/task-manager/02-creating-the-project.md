---
lesson: 2
title: Creating the project
description: Create a new FastAPI Startkit app with the installer and start the development server.
duration: 5
---

# Creating the project

**Goal:** a new app running on your machine.

## 1. Run the installer

The installer creates a project for you. Run it without any options and it asks a few questions:

```bash
uvx fastapi-startkit@latest init task-manager
```

Answer them like this:

| Question | Answer |
|---|---|
| Which services should your application run? | Web |
| Which database will your application use? | None |
| Which frontend would you like to install? | Vue |

You'll add the database yourself in lesson 5, so you can see what goes into it.

If you'd rather skip the questions, pass the answers as options. `-n` turns off the questions:

```bash
uvx fastapi-startkit@latest init task-manager --database=none --frontend=vue -n
```

::: tip No uv yet?
On macOS or Linux, the install script sets up uv for you and runs the same installer:

```bash
curl -fsSL https://fastapi-startkit.github.io/install.sh | bash -s -- task-manager --database=none --frontend=vue -n
```
:::

The installer prints each file it creates and then installs the Python packages:

```
Application: web; database: none; frontend: vue
  create .env
  create .env.example
  ...
  create routes/api.py
  create tests/test_application.py
  create vite.config.ts
Dependency: fastapi-startkit[fastapi,inertia,vite]==0.69.0
```

## 2. Start the server

Move into the new folder and start the server:

```bash
cd task-manager
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
The page at `/` is a Vue page. It needs the frontend to be built first, which you'll do in [lesson 10](./10-a-vue-page-with-inertia). Until then, stick to `/health` and `/docs`.
:::
