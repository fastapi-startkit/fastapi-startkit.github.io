# Docs Style Guide

This guide sets the voice and structure for the pages in `docs/`. It follows the conventions of the Laravel documentation (https://laravel.com/docs/13.x), adapted to FastAPI Startkit. Read it before you write or rewrite a page.

## Principles

- Write for a developer who is building an application today. Tell them what they need to do, in the order they need to do it.
- Be plain and friendly. Use second person ("you"). Contractions are fine.
- Say only what the reader needs. No marketing words, no filler, no history of how a decision was made.
- Every code sample must run against the current framework on `main`. A sample that does not run is a bug.

## Page Structure

Every page follows this order:

1. **Title** as a single `#` heading.
2. **Introduction.** Two or three sentences saying what the feature is and why you would use it. Start with the subject, not with "This page".
3. **Contents.** A short list of the H2 sections, on pages with more than three sections.
4. **Task sections.** Each H2 covers one task the reader wants to finish ("Defining Routes", "Dispatching Jobs"). Use H3 for steps or variants inside a task.
5. **Related pages.** Optional. One line linking to the next logical pages, for example "See [Queues](/docs/queues) for background work."

Use Title Case for H2 and H3 headings.

## Writing Sections

- Open each section with one or two sentences that say what the reader is about to do.
- Follow with a small, realistic code block. Use the app's own names (`Post`, `User`, `Order`, `publish_post`), not `foo` or `bar`.
- Explain the result in a sentence after the block, or show it as a comment in the block.
- Keep paragraphs short. Prefer a list when you describe steps or options.
- Use tables for reference material only: options, attributes, rule lists, and supported drivers. Do not use a table to explain a concept.

Start a sentence with "For example," when you add an illustration. Use "Of course," or "Likewise," to link ideas. Do not overuse them.

## Code Samples

- Start each file-based sample with the file path as a comment on the first line, for example `# config/app.py`.
- Import from the public path the framework documents on the page. Check it against `fastapi_startkit/src/fastapi_startkit` on `main`.
- Import `env` from `fastapi_startkit.environment` and call `env(...)` for every config field.
- Use `uv run python artisan <command>` for console commands.
- Show the expected output with a `# ` comment or a fenced `text` block when the output matters.
- Run every sample before you commit it. A sample that needs a database, Redis or an API key says so in one sentence above the block.

## Callouts

Use a callout only when skipping it would cause a real mistake, a data loss or a security problem.

- `::: tip` for a shortcut or a better option.
- `::: warning` for data loss, security or a breaking change.
- `::: danger` for an action that cannot be undone.

Use at most one callout per H2 section. Do not use a callout to repeat the text above it.

## Naming

- Facades are PascalCase and match the name in the facade module: `Cache`, `Config`, `Storage`, `Mail`, `Redis`, `Auth`, `Socialite`.
- Import facades from `fastapi_startkit.facades`. Use the real name. Do not alias a facade (for example `Notification as Notify`) unless the alias is the one the framework exports.
- Helper functions are lowercase: `env()`, `Config.get()`.
- Console commands use the framework's names exactly: `db:migrate`, `db:seed`, `provider:publish`, `serve`.
- Use "the framework" for FastAPI Startkit and "FastAPI" for the upstream project.
- Write "Pydantic", "SQLAlchemy", "Starlette" and "Jinja2" with their official capitalisation.

## Things to Avoid

- Padding such as "In this section, we will look at...", "It's important to note that..." or "Now that you have...".
- Marketing or comparison words: "powerful", "robust", "seamless", "easily", "simply", "just", "best-in-class".
- Invented justifications. Explain what the code does and when to use it. Do not explain why a field or a name exists unless the reason changes what the reader writes.
- Notes about earlier versions or old wording. Keep a deprecation note only while the old API still works, and say what replaces it.
- Warnings about shadowing, aliasing or naming pitfalls that do not change what the reader must write. If the reader must order fields a certain way, the code shows that order.
- Internal implementation detail that the reader does not need, such as which library a class wraps.
- Duplicated explanations across pages. Link to the page that owns the topic.

## Checklist Before You Commit

- [ ] Introduction says what the feature is and why to use it.
- [ ] Every H2 is a task the reader wants to finish.
- [ ] Every code sample is runnable, uses the real API on `main`, and was executed.
- [ ] Callouts are rare and each one prevents a real mistake.
- [ ] No padding, marketing words or invented justifications.
- [ ] Links point to existing pages under `/docs/...`.
- [ ] `npm run docs:build` passes.
