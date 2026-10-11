# Architectural Decision Records

| Date | Record | Decision |
|---|---|---|
| 2026-10-11 | [Site redesign: home components and docs theme](2026-10-11-home-page-redesign.md) | Home page is section components under `.vitepress/theme/home/` rendered via `Layout.vue` slots; one shared nav (`HomeNav`) on every page replaces `SiteHeader`; docs pages keep the VitePress default theme but remap its `--vp-*` variables to the cream/ink/orange tokens in `custom.css`, with the teal Tailwind tokens removed; ADRs excluded from the site build. |
