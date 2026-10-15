# Architectural Decision Records

| Date | Record | Decision |
|---|---|---|
| 2026-10-14 | [Docs header uses Instrument Sans](2026-10-14-docs-header-typography.md) | The shared header on docs pages scopes `--hp-sans` to `--site-sans`, so its title, links and wordmark use Instrument Sans; the home header and home sections keep Inter Tight. |
| 2026-10-13 | [Docs typography aligned with laravel.com](2026-10-13-docs-typography.md) | Docs body and headings use Instrument Sans (the sans laravel.com's docs use; Figtree is not referenced there), headings capped at 700, JetBrains Mono kept for code; home page fonts unchanged. |
| 2026-10-11 | [Site redesign: home components and docs theme](2026-10-11-home-page-redesign.md) | Home page is section components under `.vitepress/theme/home/` rendered via `Layout.vue` slots; one shared nav (`HomeNav`) on every page replaces `SiteHeader`; docs pages keep the VitePress default theme but remap its `--vp-*` variables to the cream/ink/orange tokens in `custom.css`, with the teal Tailwind tokens removed; ADRs excluded from the site build. |
