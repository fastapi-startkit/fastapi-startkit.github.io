# Docs content vertical rhythm

Date: 2026-11-20

## Problem

Text blocks in `.vp-doc` sit too close together, most visibly in lists. `custom.css` sets `.vp-doc { line-height: 1.25 }`. VitePress gives paragraphs their own 28px line height, but list items inherit the 1.25 (18.75px at 15px), so wrapped list items look cramped next to the paragraphs around them. Paragraph, list and heading margins are the VitePress defaults (16px, 16px, 48/32/24px), which feel tight with this site's 15px Instrument Sans.

## Alternatives

1. **Change `.vp-doc` line height to 1.75.** One line, but it also changes table cells and anything else that inherits it, which is wider than the problem.
2. **Edit the markdown** (blank lines, loose lists). Inconsistent, per page, and doesn't fix wrapped lines.
3. **Targeted theme overrides in `custom.css`** for list items, top-level paragraphs and lists, nested lists and heading margins.

## Decision

Option 3. Changes stay close to the VitePress defaults and leave code blocks, tables, custom containers, the sidebar, the nav and the home page alone.

## Implementation

In `.vitepress/theme/custom.css`, after the `.vp-doc` base rule:

- `li` line height 1.75 (26px at 15px, 24.5px at the 14px used in custom containers, close to the 24px containers already use).
- `li + li` and nested `li > ul` / `li > ol` margin-top 8px → 10px.
- Top-level paragraphs and lists (`.vp-doc > div > p|ul|ol`) margin 16px → 20px, which also widens the gap between a paragraph and the list after it. Scoped to direct children so paragraphs inside custom containers, blockquotes and loose list items keep their own margins.
- Heading margin-top: `h2` 48px → 56px, `h3` 32px → 40px, `h4` 24px → 32px.

## Validation

- `npm run docs:build` passes.
- Headless Chrome screenshots before and after at 1440px and 390px, light and dark, of `/docs/redis` (lists), `/docs/validation` (code blocks), a temporary fixture page (nested lists, loose lists, tip/warning containers with lists, a table and a code block; not committed) and `/`. The home page is pixel-identical apart from its animated marquee; code blocks, tables, containers, sidebar and nav are unchanged.
