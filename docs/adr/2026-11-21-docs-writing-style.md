# Docs writing style follows Laravel

Date: 2026-11-21

## Problem

The framework docs mix voices and structures. Some pages open with implementation detail, some explain decisions the reader does not need, and some carry notes about shadowing or old wording. A new page or rewrite has no written standard to follow, so reviewers judge each one by taste.

## Alternatives

1. **Keep writing pages ad hoc.** No work, but the inconsistency stays and every rewrite reopens the question.
2. **Adopt the Laravel documentation style in full,** including its site layout. The layout is already decided by the VitePress theme, so only the writing conventions are adopted here.
3. **Write a short style guide for the conventions that matter** (page structure, voice, code samples, callouts, naming) and check every rewrite against it.

## Decision

Option 3. `docs/STYLE.md` sets the page structure (Introduction, task-oriented H2 sections, related pages), the second-person voice, the short prose and runnable example pattern, sparing callouts, facade and helper naming, and a list of things to avoid. The guide is excluded from the site build with `srcExclude`, like the ADRs.

## Implementation

- `docs/STYLE.md`: the guide.
- `.vitepress/config.mts`: `srcExclude` adds `docs/STYLE.md`.
- `docs/adr/AGENTS.md`: index entry for this record.

## Validation

Planned checks, not yet run:

- `npm run docs:build` passes and no `/docs/STYLE` route is generated.
- The first rewrite batch follows the guide, and each sample in it runs against framework `main` with uv.

## 2026-11-21: Drop hand-written tables of contents

### Problem

The guide asked for a Contents list of H2 links near the top of longer pages. VitePress already renders the page outline beside the content, so the list repeated it and had to be kept in sync by hand whenever a heading changed.

### Decision

Pages carry no hand-written table of contents. `docs/STYLE.md` drops the Contents step from the page structure and says: "Do not add a hand-written table of contents; VitePress renders the page outline." Pages go straight from the Introduction to the task sections.

### Implementation

- `docs/STYLE.md`: the Contents step is removed and the rule is added under Page Structure.
- The batch A pages (getting-started, configuration, fastapi, exception-handling, logging, console, database/index, models, casts, migrations, seeds, relationships, orm-factory) drop their section link lists.

### Validation

- `npm run docs:build` passes.
- No batch A page has a list of links to its own sections.
