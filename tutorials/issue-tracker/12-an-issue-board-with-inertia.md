---
lesson: 12
title: An issue board with Inertia
description: Build a project board in Vue, rendered by Inertia, where you add issues, move them through the workflow and delete them.
duration: 12
---

# An issue board with Inertia

**Goal:** a `/projects/1/board` page with a column for each status, where you add, move and delete issues.

## How Inertia works

Inertia lets your controllers render Vue pages directly. You don't write a separate API for the page. A controller returns `Inertia.render("Issues/Board", props)`, and Inertia shows `resources/js/Pages/Issues/Board.vue` with those props. When the page sends a form, the controller saves the change and redirects, and Inertia swaps in the new props without a full reload.

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

## 2. Write the board controller

The board has its own controller, because it answers with pages and redirects instead of JSON. Create `app/http/controllers/issue_board_controller.py`:

```python
from fastapi_startkit.inertia import Inertia, InertiaRedirect
from fastapi_startkit.inertia.inertia import InertiaResponse
from fastapi_startkit.validation import Validated

from app.http.requests.issue import StoreIssueRequest, TransitionIssueRequest
from app.http.resources.issue import IssueResource
from app.http.resources.project import ProjectResource
from app.http.resources.user import UserResource
from app.models.issue import Issue
from app.models.project import Project
from app.models.user import User


class IssueBoardController:
    async def show(self, project: int) -> InertiaResponse:
        found = await Project.find_or_fail(project)
        issues = await Issue.with_("reporter", "assignee").where("project_id", found.id).order_by("number").get()
        users = await User.order_by("name").get()
        return Inertia.render("Issues/Board", {
            "project": ProjectResource.model_validate(found).model_dump(mode="json"),
            "issues": [IssueResource.model_validate(issue).model_dump(mode="json") for issue in issues],
            "users": [UserResource.model_validate(user).model_dump(mode="json") for user in users],
        })

    async def store(self, project: int, request: Validated[StoreIssueRequest]) -> InertiaRedirect:
        found = await Project.find_or_fail(project)
        await found.add_issue(request.model_dump())
        return Inertia.redirect(f"/projects/{found.id}/board")

    async def transition(self, issue: int, request: Validated[TransitionIssueRequest]) -> InertiaRedirect:
        found = await Issue.find_or_fail(issue)
        await found.update({"status": request.status})
        return Inertia.redirect(f"/projects/{found.project_id}/board")

    async def destroy(self, issue: int) -> InertiaRedirect:
        found = await Issue.find_or_fail(issue)
        await found.delete()
        return Inertia.redirect(f"/projects/{found.project_id}/board")
```

Almost everything here is something you already wrote:

- The requests are the same ones the API uses, so the board follows the same rules, including the workflow check from lesson 8.
- `found.add_issue()` is the method from lesson 7, so issues added on the board are numbered the same way as issues added through the API.
- The resources shape the props. `model_dump(mode="json")` turns them into plain values, such as dates as strings, so they can go to the browser.

`Inertia.redirect()` sends the browser back to the board after each change. When validation fails, the framework redirects back on its own and puts the errors in the session for the page to show.

## 3. Add the web routes

Create `routes/web.py`:

```python
from app.http.controllers.issue_board_controller import IssueBoardController
from fastapi_startkit.fastapi import Router

board = IssueBoardController()

web = Router()
web.get("/projects/{project}/board", board.show, response_model=None)
web.post("/projects/{project}/board", board.store, response_model=None)
web.post("/issues/{issue}/transitions", board.transition, response_model=None)
web.delete("/issues/{issue}", board.destroy, response_model=None)
```

These paths have no `/api` prefix, so they don't clash with the API routes. `response_model=None` tells FastAPI not to build a JSON schema for a route that returns a page or a redirect.

Then add the router in `providers/fastapi_provider.py`:

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

Create `resources/js/Pages/Issues/Board.vue`:

```vue
<script setup lang="ts">
import { router, useForm } from '@inertiajs/vue3'

type User = { id: number, name: string }
type Issue = { id: number, key: string, title: string, status: string, priority: string, assignee: User | null, transitions: string[] }
type Project = { id: number, key: string, name: string }

const props = defineProps<{ project: Project, issues: Issue[], users: User[] }>()

const columns = { todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done' }

const form = useForm({ title: '', reporter_id: props.users[0]?.id })

function addIssue() {
    form.post(`/projects/${props.project.id}/board`, { onSuccess: () => form.reset('title') })
}

function move(issue: Issue, status: string) {
    router.post(`/issues/${issue.id}/transitions`, { status }, { preserveScroll: true })
}

function remove(issue: Issue) {
    router.delete(`/issues/${issue.id}`, { preserveScroll: true })
}
</script>

<template>
    <main class="mx-auto max-w-6xl p-8">
        <h1 class="text-3xl font-semibold">{{ project.name }}</h1>

        <form class="mt-6 flex gap-2" @submit.prevent="addIssue">
            <input v-model="form.title" class="flex-1 rounded border p-2" placeholder="What's the issue?">
            <select v-model="form.reporter_id" class="rounded border p-2">
                <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }}</option>
            </select>
            <button class="rounded bg-emerald-700 px-4 text-white" :disabled="form.processing">Add</button>
        </form>
        <p v-if="form.errors.title" class="mt-2 text-sm text-red-600">{{ form.errors.title }}</p>

        <div class="mt-8 grid grid-cols-4 gap-4">
            <section v-for="(label, status) in columns" :key="status" class="rounded bg-stone-100 p-3">
                <h2 class="font-medium">{{ label }}</h2>
                <article
                    v-for="issue in issues.filter(issue => issue.status === status)"
                    :key="issue.id"
                    class="mt-3 rounded border bg-white p-3"
                >
                    <p class="text-xs text-stone-500">{{ issue.key }} · {{ issue.priority }}</p>
                    <p class="mt-1">{{ issue.title }}</p>
                    <p class="mt-1 text-xs text-stone-500">{{ issue.assignee?.name ?? 'Unassigned' }}</p>
                    <div class="mt-2 flex flex-wrap gap-2 text-sm">
                        <button
                            v-for="next in issue.transitions"
                            :key="next"
                            class="text-emerald-700"
                            @click="move(issue, next)"
                        >
                            → {{ columns[next] }}
                        </button>
                        <button class="ml-auto text-red-600" @click="remove(issue)">Delete</button>
                    </div>
                </article>
            </section>
        </div>
    </main>
</template>
```

Here's how the page works:

- `columns` lists the four statuses in order. Each column shows the issues with that status.
- Every issue already carries its `transitions` from lesson 8, so the page shows one button per allowed move and never has to know the workflow itself.
- `useForm()` keeps track of the form's fields, whether it's sending and any errors from the server.
- `router.post()` and `router.delete()` send a change. Inertia follows the redirect and reloads the props, and `preserveScroll` keeps your place on the page.

## 5. Build the frontend

Install the JavaScript packages and build the assets:

```bash
npm install
npm run build
```

Run `npm run build` again after each change to a `.vue` file.

## Check

Reset the sample data so the board has something on it, then start the server:

```bash
uv run python artisan db:migrate:fresh
uv run python artisan db:seed
uv run python artisan serve
```

Open `http://127.0.0.1:8000/projects/1/board`. The five `WEB` issues sit in their columns.

- Type a title and press **Add**. `WEB-6` appears under **To Do**.
- Press **Add** with an empty title. The page shows `The title field is required.` under the form.
- Press **→ In Progress** on `WEB-6`. It moves to the next column, and its buttons change to the moves allowed from there.
- Press **Delete**. The issue is gone.

The page never fully reloads. `curl http://127.0.0.1:8000/api/projects/1/issues` shows the same changes, because the board and the API share the same models and rules.

The home page at `/` works now too, since the frontend is built.
