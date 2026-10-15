# Docs header uses Instrument Sans

Date: 2026-10-14

## Problem

The docs typography change in [2026-10-13](2026-10-13-docs-typography.md) moved body and headings to Instrument Sans by redefining `--site-sans`, but the site header still renders in Inter Tight. `HomeNav` is the one nav shared by every page, and its title, links and wordmark read `--hp-sans`, a home-page token that is still `"Inter Tight"`. The header therefore kept the old face on every docs page.

## Alternatives

1. **Repoint `--hp-sans` globally to `--site-sans`.** One line, but it also restyles the home page nav and every home section that uses `--hp-sans`, which the home page design does not allow.
2. **Replace `var(--hp-sans)` in `HomeNav` and `BrandMark` with `var(--site-sans)`.** Changes the home header too, so the home page would no longer match its design.
3. **Scope the override to the header on docs pages.** `HomeNav` already knows whether the page is under `docs/`; it sets `--hp-sans` to `--site-sans` only there.

## Decision

Option 3. The docs header reads Instrument Sans, and the home header and all home sections keep Inter Tight.

## Implementation

- `.vitepress/theme/home/HomeNav.vue`: the header adds the `hp-nav--docs` class when `inDocs` is true, and that class redefines `--hp-sans` as `var(--site-sans)`. Custom properties inherit, so the nav links and the `startkit` part of `BrandMark` pick it up without changes to `BrandMark`.
- The `fastapi` part of the wordmark stays in Instrument Serif, and the search button stays in JetBrains Mono, as they are part of the logo and the code/label style.
- No font loading changes: Instrument Sans is already in the Google Fonts request from the typography change.

## Validation

- `npm run docs:build` passes.
- In a headless Chromium on `/docs/database/`, the nav links and wordmark compute to Instrument Sans in light and dark themes and at 390px. The same elements on `/` still compute to Inter Tight.
- At 390px the header fits without horizontal page scroll.
