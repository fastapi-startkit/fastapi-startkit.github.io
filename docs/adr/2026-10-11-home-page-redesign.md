# Home page redesign as custom theme components

Date: 2026-10-11

## Problem

The home page was built from VitePress `hero`/`features` frontmatter plus a set of loosely related components (`HeroSection`, `CoreModules`, `PerformanceBenchmarks`, `Testimonials`, `FinalCTA`, `SiteFooter`). It did not communicate what makes the framework distinct — provider-based composition, the Artisan CLI, MCP servers and agent testing — and could not express the new neo-brutalist design: cream background, heavy sans headlines with an orange italic serif accent, hard offset shadows, terminal-style code cards.

## Alternatives

1. **Restyle VPHero / VPFeatures with CSS.** Cheapest, but the default components cannot render interactive sections (provider toggles, comparison tabs), a marquee, a bento grid or a full-bleed footer. CSS overrides against VitePress internals also break on upgrades.
2. **Write the page as Markdown with inline Vue.** Keeps content in `index.md`, but mixes several hundred lines of layout into Markdown and loses scoped styles per section.
3. **Custom Vue components rendered through the theme `Layout` slots.** Full control over markup, accessibility and responsive behaviour while leaving the default theme in charge of every docs page.

## Decision

Option 3. `index.md` keeps `layout: home` with no `hero`/`features`, and `Layout.vue` renders `HomePage` in the `home-hero-before` slot and `HomeNav` in `layout-top` when the page is the home layout. All other pages keep `SiteHeader` and the default theme untouched.

## Implementation

- `.vitepress/theme/home/` holds one component per section: `HomeNav`, `HomeHero`, `HomeMarquee`, `HomeProviders`, `HomeBento`, `HomeAgents`, `HomeTesting`, `HomeLaravel`, `HomeSteps`, `HomeCta`, `HomeFooter`, composed by `HomePage`.
- Shared pieces: `CodeCard` (terminal card), `InstallPill` (copy-to-clipboard), `BrandMark`, `highlight.ts` (a small Python/PHP/Bash token highlighter so snippets need no runtime dependency) and `snippets.ts` (all code shown on the page).
- `home.css` defines design tokens scoped to `.hp` / `.hp-nav`, so the home styles cannot leak into docs pages. `.dark .hp` remaps the tokens, so the page follows the VitePress appearance toggle.
- Fonts (Inter Tight, Instrument Serif, JetBrains Mono, plus the docs fonts Geist and Inter) load through `preconnect` and a stylesheet `<link>` in the VitePress `head` config instead of a render-blocking CSS `@import`, limited to the family, weight and style combinations that actually render.
- Interactivity: provider switches use `role="switch"` and an `aria-live` summary; the Laravel comparison is an ARIA tablist with arrow/Home/End keys; hero file tabs are `aria-pressed` buttons; all controls have an orange `:focus-visible` ring.
- `prefers-reduced-motion` stops the marquee and lets its items wrap.
- Stacked grids use `minmax(0, 1fr)` so wide code blocks scroll inside their card instead of widening the page on phones.
- Every snippet uses the real API: `Application(base_path=..., providers=[...])`, `LogProvider`, `DatabaseProvider`, `FastAPIProvider`, `RedisProvider`, `StorageProvider`, `AIProvider`, `McpProvider`, class-based MCP `Tool`, `Agent.record()` / `assert_tool_called()` / `assert_response_judged()`, and `python artisan db:*` commands.
- Removed the Vue components used only by the old home page. The `.vitepress/theme/snippets/*.py` files it imported are left in place and are now unreferenced. ADRs under `docs/adr/` are excluded from the VitePress build via `srcExclude`.

## Validation

- `npm run docs:build` passes.
- Playwright screenshots at 1440px and 375px in light and dark mode with reduced motion: zero horizontal overflow, and no elements extend past the viewport outside scrollable code blocks.
- `/docs/getting-started` still renders with `SiteHeader`, sidebar and outline.
- Keyboard check: tab order reaches nav, copy buttons, hero tabs, provider switches, presets and comparison tabs; arrow keys move between comparison tabs.
