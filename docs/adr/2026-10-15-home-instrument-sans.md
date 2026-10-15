# Home page uses Instrument Sans

Date: 2026-10-15

## Problem

The docs header and body use Instrument Sans, but the home page still uses Inter Tight. `--hp-sans` is defined once in `home/home.css` as a literal Inter Tight stack, so every home section and the home header keep Inter Tight. That leaves the two halves of the site in different sans faces, which is the mismatch the typography change was meant to remove.

## Alternatives

1. **Keep the home page on Inter Tight.** Preserves the current home look, but the header on docs pages and the home page stay visibly different.
2. **Override `--hp-sans` only in the header.** Already done for docs pages; it leaves the home sections on Inter Tight.
3. **Point `--hp-sans` at `--site-sans`.** One token change in `home.css`, so the header and every home section use the same face as the docs.

## Decision

Option 3. `--hp-sans` becomes `var(--site-sans)`. The docs-only override on the header is removed because it is now redundant.

## Implementation

- `.vitepress/theme/home/home.css`: `--hp-sans` is `var(--site-sans)`.
- `.vitepress/theme/home/HomeNav.vue`: the `hp-nav--docs` class and its rule are removed.
- Home headings that use weight 800 render at Instrument Sans's maximum of 700, so they look lighter than before. Serif accents and mono labels are unchanged.

## Validation

- `npm run docs:build` passes.
- In headless Chromium on `/` at 1280px and 390px, the header and home headings compute to Instrument Sans, with no horizontal scroll.
- On `/docs/database/`, the header still computes to Instrument Sans.
