# Tutorials section with courses and lessons

Date: 2026-10-27

## Problem

The docs are reference pages. They explain every option but don't walk a newcomer from an empty folder to a working feature. Laravel Learn solves this with courses: short, numbered lessons, each with one goal, a few steps and a result, plus progress and prev/next links. We want the same for FastAPI Startkit, and adding a course later should not need any theme work.

The first draft had only an AI agent course. Readers pointed out that it taught the AI package more than the framework, so a framework course, "Build a Task Manager", now comes first.

## Alternatives

1. **Plain markdown pages under `docs/` with a sidebar group.** No code, but no lesson numbers, progress or course pages, and every course needs sidebar edits.
2. **A separate app or VitePress site for tutorials.** Full control, but a second build, a second nav and duplicated styling.
3. **A tutorials area in the same site, driven by frontmatter.** A content loader reads `tutorials/*/*.md`, and theme components render the index, course and lesson chrome from that data.

## Decision

Option 3.

- `tutorials/index.md` (`tutorials: index`) lists every course as a card.
- `tutorials/<course>/index.md` (`course: true`, `title`, `description`, `level`, `order`) is the course page. It lists its lessons and links to the first one.
- `tutorials/<course>/NN-slug.md` (`lesson: N`, `title`, `description`, `duration` in minutes) is a lesson. It shows the course breadcrumb, "Lesson N of M", the duration, a progress bar, a lesson list with done and current states in the aside, and prev/next cards that start at the course page and end at the tutorials index.
- Lessons are ordered by the `lesson` number, courses by `order` (lowest first, then title), and course duration is the sum of its lessons. "Build a Task Manager" has `order: 1` and "Build an AI Agent" has `order: 2`, so the framework course is the first card.
- The docs sidebar is scoped to `/docs/`, so tutorials get the full width and their own aside.
- The shared header gets a "Tutorials" link ("Learn" at 480px and below, like "Docs"; the GitHub icon hides at 420px and below so both links fit), and the AI sidebar group links to the agent course.

## Implementation

- `.vitepress/theme/tutorials/tutorials.data.ts` uses `createContentLoader` to build `Course[]` with their lessons.
- `useTutorial()` finds the current course and lesson from `relativePath` and returns prev, next and progress.
- `TutorialsIndex`, `CourseHeader`, `CourseLessons`, `LessonHeader`, `LessonAside` and `LessonNav` are mounted through the `doc-before`, `doc-footer-before` and `aside-top` slots in `Layout.vue`, chosen by frontmatter.
- `TutorialsFooter` holds the course cards, lesson list and prev/next. It goes in `doc-footer-before` so it sits above "Last updated". When a page has no footer (no last-updated date yet and no edit link), it falls back to `doc-after` so it still shows.
- `tutorials.css` uses the site tokens (`--site-line`, offset shadows, mono labels, orange accent) and collapses the pager to one column on phones.
- "Build a Task Manager" has 12 lessons building a projects-and-tasks app from `init`: a config value read with `env()`, `Router` and `resource()`, `db:install` with SQLite, migrations, models, seeders, CRUD with validation and 404s, `HasMany`/`BelongsTo` with eager loading, pagination, an Inertia Vue page and HTTP tests with `RefreshDatabase`. Auth is left to What's next, because it lives in the separate `fastapi-startkit-auth` package.
- "Build an AI Agent" has 11 lessons building a job-search assistant: agent, streaming, tools, a summarizer agent, structured output, memory, middleware and offline tests.

## Validation

- Every Task Manager sample was run in a project made with `uvx fastapi-startkit@latest init task-manager --database=none --frontend=vue -n` on 0.69.0. Migrations, `db:seed` and the API all ran (201, 200, 204, 404 and 422), as did pagination driven by `TASKS_PER_PAGE`. The Inertia page was driven in Chromium: add, empty-title error, toggle and delete all worked with no console errors. `uv run pytest` passes 5 tests.
- Every AI agent sample was run in a fresh `uvx fastapi-startkit@latest init` project with `fastapi-startkit[fastapi,ai]` and `langchain-google-genai`. The lesson 10 test suite passes with fakes and a replayed cassette, and no API key.
- The server booted, `/health` answered, and `/chat` without a key returned the Gemini "API key required" error quoted in lesson 3.
- `npm run docs:build` passes with no dead links.
- The built site was screenshotted at 1440, 390 and 360px wide: no horizontal scroll on the index, course and lesson pages, in light and dark. Light mode has no console errors. Dark mode shows the same hydration-mismatch warning that main already has.
