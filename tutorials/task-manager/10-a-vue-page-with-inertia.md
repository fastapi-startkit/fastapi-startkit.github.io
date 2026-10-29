---
lesson: 10
title: A Vue page with Inertia
description: Build a tasks page in Vue, rendered by Inertia, with forms that create, complete and delete tasks.
duration: 10
---

# A Vue page with Inertia

**Goal:** a `/tasks` page where you add, finish and delete tasks.

## How Inertia works

Inertia lets your controllers render Vue pages directly. You don't write a separate API for the page. A controller returns `Inertia.render("Tasks/Index", props)`, and Inertia shows `resources/js/Pages/Tasks/Index.vue` with those props. When the page sends a form, the controller saves the change and redirects, and Inertia swaps in the new props without a full reload.

The installer set up Vue, Vite, Tailwind and Inertia when you picked the Vue frontend in lesson 2.

## 1. Add a session

When a form fails validation, Inertia sends the errors back to the page through the session. Add the session middleware at the end of `bootstrap/application.py`:

```python
from starlette.middleware.sessions import SessionMiddleware # [!code ++]
from fastapi_startkit.environment import env # [!code ++]

app = Application(
    ...
)

app.add_middleware(SessionMiddleware, secret_key=env("SESSION_SECRET")) # [!code ++]
```

The session cookie is signed with this key, so make it a long random string. Add it to `.env`:

```ini
SESSION_SECRET=change-me-to-a-long-random-string
```

## 2. Write the page controller

The page has its own controller, because it answers with pages and redirects instead of JSON. Create `app/http/controllers/task_page_controller.py`:

```python
from fastapi.responses import RedirectResponse
from fastapi_startkit.inertia import Inertia
from fastapi_startkit.inertia.inertia import InertiaResponse

from app.http.requests.task import StoreTaskRequest, UpdateTaskRequest
from app.http.resources.task import ProjectResource
from app.models.project import Project
from app.models.task import Task


class TaskPageController:
    async def index(self) -> InertiaResponse:
        projects = await Project.with_("tasks").order_by("name").get()
        return Inertia.render("Tasks/Index", {
            "projects": [ProjectResource.model_validate(project).model_dump(mode="json") for project in projects],
        })

    async def store(self, request: StoreTaskRequest) -> RedirectResponse:
        await Task.create(request.model_dump())
        return RedirectResponse(url="/tasks", status_code=303)

    async def update(self, task: int, request: UpdateTaskRequest) -> RedirectResponse:
        found = await Task.find_or_fail(task)
        await found.update(request.model_dump(exclude_unset=True))
        return RedirectResponse(url="/tasks", status_code=303)

    async def destroy(self, task: int) -> RedirectResponse:
        found = await Task.find_or_fail(task)
        await found.delete()
        return RedirectResponse(url="/tasks", status_code=303)
```

It reuses the request and resource classes you already have. `model_dump(mode="json")` turns the dates into strings so they can go to the browser. Status `303` tells the browser to follow the redirect with a `GET`.

## 3. Add the web routes

Create `routes/web.py`:

```python
from app.http.controllers.task_page_controller import TaskPageController
from fastapi_startkit.fastapi import Router

tasks = TaskPageController()

web = Router()
web.get("/tasks", tasks.index, response_model=None)
web.post("/tasks", tasks.store)
web.put("/tasks/{task}", tasks.update)
web.delete("/tasks/{task}", tasks.destroy)
```

`response_model=None` tells FastAPI not to build a JSON schema for a route that returns a page. Then add the router in `providers/fastapi_provider.py`:

```python
class FastapiProvider(FastAPIProvider):
    def boot(self):
        super().boot()
        from routes.api import api, router
        from routes.web import web # [!code ++]

        self.app.fastapi.include_router(router.router)
        self.app.fastapi.include_router(api.router)
        self.app.fastapi.include_router(web.router) # [!code ++]
```

## 4. Write the page

Create `resources/js/Pages/Tasks/Index.vue`:

```vue
<script setup lang="ts">
import { router, useForm } from '@inertiajs/vue3'

type Task = { id: number, project_id: number, title: string, completed: boolean }
type Project = { id: number, name: string, tasks: Task[] }

const props = defineProps<{ projects: Project[] }>()

const form = useForm({ project_id: props.projects[0]?.id, title: '' })

function addTask() {
    form.post('/tasks', { onSuccess: () => form.reset('title') })
}

function toggle(task: Task) {
    router.put(`/tasks/${task.id}`, { completed: !task.completed }, { preserveScroll: true })
}

function remove(task: Task) {
    router.delete(`/tasks/${task.id}`, { preserveScroll: true })
}
</script>

<template>
    <main class="mx-auto max-w-2xl p-8">
        <h1 class="text-3xl font-semibold">Tasks</h1>

        <form class="mt-6 flex gap-2" @submit.prevent="addTask">
            <select v-model="form.project_id" class="rounded border p-2">
                <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
            </select>
            <input v-model="form.title" class="flex-1 rounded border p-2" placeholder="What needs doing?">
            <button class="rounded bg-emerald-700 px-4 text-white" :disabled="form.processing">Add</button>
        </form>
        <p v-if="form.errors.title" class="mt-2 text-sm text-red-600">{{ form.errors.title }}</p>

        <section v-for="project in projects" :key="project.id" class="mt-8">
            <h2 class="text-lg font-medium">{{ project.name }}</h2>
            <ul class="mt-2 divide-y rounded border">
                <li v-for="task in project.tasks" :key="task.id" class="flex items-center gap-3 p-3">
                    <input type="checkbox" :checked="task.completed" @change="toggle(task)">
                    <span :class="{ 'text-gray-400 line-through': task.completed }" class="flex-1">{{ task.title }}</span>
                    <button class="text-sm text-red-600" @click="remove(task)">Delete</button>
                </li>
            </ul>
        </section>
    </main>
</template>
```

`useForm()` keeps track of the form's fields, whether it's sending and any errors from the server. `router.put()` and `router.delete()` send the change, and Inertia reloads the props after the redirect.

## 5. Build the frontend

Install the JavaScript packages and build the assets:

```bash
npm install
npm run build
```

Run `npm run build` again after each change to a `.vue` file.

## Check

Open `http://127.0.0.1:8000/tasks`. You'll see both projects with their tasks.

- Type a title and press **Add**. The task appears under its project.
- Press **Add** with an empty title. The page shows `String should have at least 1 character` under the form.
- Tick a checkbox. The task is crossed out.
- Press **Delete**. The task is gone.

The page never fully reloads, and `/api/tasks` shows the same changes, because both talk to the same database.

The home page at `/` works now too, since the frontend is built.
