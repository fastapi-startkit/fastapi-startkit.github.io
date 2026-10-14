# Docs typography aligned with laravel.com

Date: 2026-10-13

## Problem

The docs pages set body and headings in Inter Tight, a tight display face, with 800-weight headings and tight negative tracking. Long-form reading text looks cramped next to the cream background and the code cards, and it does not match the typographic register of laravel.com docs, which the framework's docs are modelled on.

## Alternatives

1. **Figtree.** Named in the task as Laravel's body font. Inspecting laravel.com's current stylesheet shows Figtree is not referenced at all, so it would not match what the site renders today.
2. **Instrument Sans.** The sans family laravel.com's docs pages use: the `font-sans` utility resolves to `--font-sans: "InstrumentSans"`, and the docs page body carries `font-sans`.
3. **Keep Inter Tight and only tune weights and tracking.** Smallest change, but does not move the typeface toward the reference.

## Decision

Option 2. Docs body and headings use Instrument Sans with a system fallback stack. Headings drop from 800 to 700, because Instrument Sans is published at weights 400 to 700. Code stays in JetBrains Mono, which already renders readably in both themes and in the code cards.

The home page keeps Inter Tight, Instrument Serif and its own `--hp-*` tokens, so this change is confined to the docs theme and does not restyle the landing page.

## Implementation

- `.vitepress/config.mts`: the Google Fonts stylesheet adds `Instrument+Sans:wght@400..700`. Inter Tight stays in the same request because the home page still uses it.
- `.vitepress/theme/custom.css`: `--site-sans` becomes `"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`. Heading rules that used weight 800 use 700.
- No markup, component, or code block styling changes.

## Validation

- `npm run docs:build` passes.
- `npm run docs:dev` is used to compare the home page, a getting-started page and a page with code blocks in light and dark themes against laravel.com.
- With the web font blocked, text falls back to the system sans stack without layout breakage.
- At 375px width, body text and headings wrap inside the 16px gutter with no horizontal page scroll.
