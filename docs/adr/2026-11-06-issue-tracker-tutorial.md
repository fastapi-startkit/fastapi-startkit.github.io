# Build an Issue Tracker tutorial course

Date: 2026-11-06

## Problem

The tutorials section has a beginner framework course (Task Manager) and an AI course. Neither shows the parts of the framework a real business app leans on: rule-based validation with `FormRequest`, cross-field and database-aware validation, several relationships on one model, nested eager loading, query-string filters and a state machine. Readers who finish Task Manager have no guided next step for those.

## Alternatives

1. **Extend Task Manager with more lessons.** Keeps one app, but the course is already twelve lessons and aimed at first-time users. Adding workflow and filtering would make it long and mix levels.
2. **Write reference pages instead of a course.** Cheaper, but the request was a hands-on tutorial built step by step.
3. **A separate intermediate course with its own example repository.** One new app, one goal per lesson, and a public repository where every lesson is one tagged commit.

## Decision

Option 3. Add `tutorials/issue-tracker/` as "Build an Issue Tracker", `level: Intermediate`, `order: 3`, with eleven lessons:

| Lesson | Adds |
|---|---|
| 1 | The app, the data model and the workflow |
| 2 | The project, created with `fastapi-startkit init --database=sqlite` |
| 3 | `users` and `projects` migrations, models and seeders |
| 4 | Projects and users API with `FormRequest` rules (`regex`, `unique`) |
| 5 | Issues with per-project keys, enum priorities and `BelongsTo` reporter and assignee |
| 6 | A status workflow enforced by an `after()` validation hook |
| 7 | `PATCH` to assign, unassign and reprioritise |
| 8 | Comments, `HasMany` and nested eager loading with `with_("comments.author")` |
| 9 | Filters, search, sorting and pagination from `Validated` query strings and a config class |
| 10 | HTTP tests with `HttpTestCase` and `RefreshDatabase` |
| 11 | What's next |

The finished app lives at `github.com/fastapi-startkit/issue-tracker`. Each lesson from 2 to 10 is one commit tagged `lesson-NN`. Every lesson links to its tag and to a compare view against the previous tag, so a reader can check their code against the exact diff.

## Implementation

- Course and lesson frontmatter follow the existing courses (`course: true`, `order`, `aside: false`; `lesson`, `title`, `description`, `duration`), so the existing tutorial components list and navigate the new course without theme changes.
- Lessons use the same shape: `**Goal:**`, numbered steps, `// [!code ++]` diff markers on changed files, and a `## Check` section.
- Task Manager's "What's next?" lesson links on to the new course.
- No framework code changes.

## Validation

- Each tag was cloned fresh, migrated, seeded and served, and every `Check` command was run against it. The outputs in the lessons are those responses, with timestamps shortened.
- `uv run pytest` passes at `lesson-10` and on `main` from a fresh clone.
- `npm run docs:build` passes with no dead links, and the course appears on `/tutorials/` after the AI course.
