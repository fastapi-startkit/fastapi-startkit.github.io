# One beginner course: Build an Issue Tracker

Date: 2026-11-06

## Problem

The tutorials section had two framework courses. "Build a Task Manager" was a beginner course on projects and tasks. "Build an Issue Tracker" was an intermediate course on validation rules, a status workflow, relationships and filters. Both started from `init` and repeated the same setup, migrations and seeders, so a reader doing both built the same foundations twice. Neither course alone covered the whole framework: Task Manager had the config value and the Inertia page, and Issue Tracker had everything after basic CRUD.

## Alternatives

1. **Keep both courses and link Task Manager to Issue Tracker.** No rewrite, but the setup is taught twice and the reader has to switch apps halfway.
2. **Extend Task Manager with Issue Tracker's topics.** One course, but tasks don't need keys, a workflow or comments, so the later lessons would feel forced.
3. **Merge into one beginner course built around the issue tracker.** The issue domain needs every topic naturally. Task Manager's introductory lessons (project tour, config value, routes and controllers, the Inertia page) move into it, and the Task domain is dropped.

## Decision

Option 3. `tutorials/issue-tracker/` is "Build an Issue Tracker", `level: Beginner`, `order: 1`, with fourteen lessons. `tutorials/task-manager/` is removed.

| Lesson | Adds |
|---|---|
| 1 | The app, the data model, the workflow and the plan |
| 2 | The project, created with the installer (Web, SQLite, Vue) |
| 3 | A tour of the folders and providers, and `config/issues.py` read with `env()` |
| 4 | A controller and `Router(prefix="/api")` with `resource(only=...)`, included by the provider |
| 5 | `users` and `projects` migrations, models and seeders |
| 6 | The projects API with `FormRequest` rules, `201` and `find_or_fail()` |
| 7 | Issues with enums, `BelongsTo`/`HasMany`, and per-project keys from `Project.add_issue()` |
| 8 | A status workflow enforced by an `after()` validation hook |
| 9 | `PATCH` edits (title, description, priority, assignee) and `DELETE` |
| 10 | Comments, eager loading with `with_()`/`load()`, `LazyLoadingViolation` and nested paths |
| 11 | Filters, search, sorting and pagination from `Validated` query strings |
| 12 | A Vue issue board rendered with Inertia, using the same requests and `add_issue()` as the API |
| 13 | HTTP tests with `HttpTestCase`, `RefreshDatabase` and `assert_inertia` |
| 14 | What's next |

Issue numbering lives in `Project.add_issue()`, so the API and the board number issues the same way. The update request uses pydantic `StringConstraints(min_length=1)` for `title`, because `Field()` rules skip empty values on fields that aren't `required()`.

The "Compare your code" boxes and "The finished app" section are removed. The `fastapi-startkit/issue-tracker` companion repository still has the old eleven-lesson tags, so linking to it would point readers at code that no longer matches. Rebuilding it with one tag per new lesson is a follow-up.

## Implementation

- Lessons that came from Task Manager were moved with `git mv` and rewritten for the issue domain. Issue Tracker lessons were renumbered and their `lesson:` frontmatter updated.
- Course and lesson frontmatter follow the existing format, so the tutorial components list and navigate the course without theme changes.
- Lessons keep the same shape: `**Goal:**`, numbered steps, `# [!code ++]`/`# [!code --]` diff markers on changed files, and a `## Check` section.
- No framework code changes.

## Validation

- A fresh app was made with the installer on framework 0.75.1. Lessons 3 to 5 were replayed on it: the config check printed the `.env` value, the made-up projects list returned `200`, and the migrations, `db:migrate:status` and seeded rows matched the lesson output.
- The finished code for lessons 6 to 13 was built in a scratch app and every `Check` was run against it: `201`, `200`, `204`, `404` and `422` responses, the workflow refusal, comments, and filters and pagination driven by `ISSUES_PER_PAGE`. The outputs in the lessons are those responses, with timestamps shortened.
- The board was driven in Chromium: add, the empty-title error, a move to In Progress and delete all worked with no page errors.
- `uv run pytest` passes 9 tests (1 application, 8 issues).
- `npm run docs:build` passes with no dead links.
