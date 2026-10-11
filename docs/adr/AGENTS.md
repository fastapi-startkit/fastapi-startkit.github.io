# Architectural Decision Records

| Date | Record | Decision |
|---|---|---|
| 2026-10-11 | [Home page redesign as custom theme components](2026-10-11-home-page-redesign.md) | Replace VPHero/VPFeatures with section components under `.vitepress/theme/home/`, rendered via `Layout.vue` slots only on the home layout; tokens scoped to `.hp` so docs pages are unaffected; ADRs excluded from the site build. |
