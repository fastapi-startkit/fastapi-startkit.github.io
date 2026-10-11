# Site redesign: home components and docs theme

Date: 2026-10-11

## Problem

The home page was built from VitePress `hero`/`features` frontmatter plus a set of loosely related components (`HeroSection`, `CoreModules`, `PerformanceBenchmarks`, `Testimonials`, `FinalCTA`, `SiteFooter`). It did not communicate what makes the framework distinct — provider-based composition, the Artisan CLI, MCP servers and agent testing — and could not express the new neo-brutalist design: cream background, heavy sans headlines with an orange italic serif accent, hard offset shadows, terminal-style code cards.

Once the home page moved to that design, the docs pages still used a separate teal `SiteHeader`, Geist/Inter fonts and a blue-grey Tailwind palette, so moving from the home page into the docs felt like visiting a different site.

## Alternatives

1. **Restyle VPHero / VPFeatures with CSS.** Cheapest, but the default components cannot render interactive sections (provider toggles, comparison tabs), a marquee, a bento grid or a full-bleed footer. CSS overrides against VitePress internals also break on upgrades.
2. **Write the page as Markdown with inline Vue.** Keeps content in `index.md`, but mixes several hundred lines of layout into Markdown and loses scoped styles per section.
3. **Custom Vue components rendered through the theme `Layout` slots.** Full control over markup, accessibility and responsive behaviour while leaving the default theme in charge of every docs page.

For the docs pages:

1. **Replace the default theme's doc layout with custom components.** Total control, but re-implements sidebar, outline, search, prev/next and the mobile menu.
2. **Keep the default theme and remap its CSS variables**, adding a small number of targeted rules for borders, shadows and type. Every built-in behaviour keeps working and upgrades stay cheap.

## Decision

Option 3 for the home page, option 2 for the docs. `index.md` keeps `layout: home` with no `hero`/`features`; `Layout.vue` renders `HomePage` in the `home-hero-before` slot and the shared `HomeNav` in `layout-top` on every page (sticky on the home page, fixed on docs pages so VitePress's content offset still applies). `SiteHeader` is removed.

## Implementation

- `.vitepress/theme/home/` holds one component per section: `HomeNav`, `HomeHero`, `HomeMarquee`, `HomeProviders`, `HomeBento`, `HomeAgents`, `HomeTesting`, `HomeLaravel`, `HomeSteps`, `HomeCta`, `HomeFooter`, composed by `HomePage`.
- Shared pieces: `CodeCard` (terminal card), `InstallPill` (copy-to-clipboard), `BrandMark` (orange tile with the lucide `Zap` icon from the previous nav, italic serif "fastapi", heavy sans "startkit" and an orange dot, matching the footer wordmark), `highlight.ts` (a small Python/PHP/Bash token highlighter so snippets need no runtime dependency) and `snippets.ts` (all code shown on the page).
- The hero code card keeps the previous hero's content: Database, Log, MCP and Testing tabs, each with its multi-file snippets selectable as file chips. The code lives as strings in `snippets.ts` rather than raw `.py` imports.
- `home.css` defines design tokens scoped to `.hp` / `.hp-nav`; `.dark .hp` remaps them so the page follows the VitePress appearance toggle.
- `custom.css` defines the same palette as `--site-*` tokens on `:root` / `.dark` and maps them onto VitePress variables (`--vp-c-bg*`, `--vp-c-text-*`, `--vp-c-brand-*`, code, button and local-search variables). Targeted rules add the ink borders and hard shadows to the sidebar, code blocks, code groups, tables, custom blocks, pager links and the search modal; headings use Inter Tight, labels use uppercase JetBrains Mono. Code blocks render as dark terminal cards in both themes by applying Shiki's dark colours in light mode; github-dark's comment grey is lifted to meet 4.5:1. The teal Tailwind `@theme` tokens and their utility classes are removed.
- Fonts (Inter Tight, Instrument Serif, JetBrains Mono) load through `preconnect` and a stylesheet `<link>` in the VitePress `head` config instead of a render-blocking CSS `@import`, limited to the family, weight and style combinations that actually render. Geist and Inter are no longer loaded.
- Interactivity: provider switches use `role="switch"` and an `aria-live` summary; the Laravel comparison is an ARIA tablist with arrow/Home/End keys; hero module tabs and file chips are `aria-pressed` buttons; all controls have an orange `:focus-visible` ring.
- `prefers-reduced-motion` stops the marquee and lets its items wrap, and removes hover transitions.
- Stacked grids use `minmax(0, 1fr)` so wide code blocks scroll inside their card instead of widening the page on phones; docs code blocks stay inside the 24px content gutter on phones instead of bleeding to the edge.
- Every snippet uses the real API: `Application(base_path=..., providers=[...])`, `LogProvider`, `DatabaseProvider`, `FastAPIProvider`, `RedisProvider`, `StorageProvider`, `AIProvider`, `McpProvider`, class-based MCP `Server`/`Tool`, models with typed attributes, `Agent.record()` / `assert_tool_called()` / `assert_response_judged()`, and `python artisan db:*` commands.
- Removed the Vue components used only by the old home page. The `.vitepress/theme/snippets/*.py` files it imported were removed, as nothing references them. ADRs under `docs/adr/` are excluded from the VitePress build via `srcExclude`.

## Validation

- `npm run docs:build` passes.
- Playwright screenshots of the home page and six docs pages (getting started, agents, models, MCP, Inertia, FastAPI with code groups) at 1440px and 375px in light and dark mode with reduced motion: zero horizontal overflow, and no elements extend past the viewport outside scrollable code blocks.
- Contrast check on docs body text, links, inline code, sidebar, outline, tables, code tokens, pager and nav in both themes: all at least 4.5:1.
- Local search opens from the nav button and returns results; the mobile "Menu" opens the sidebar and navigates; prev/next links render.
- Keyboard check: tab order reaches nav, copy buttons, hero tabs and file chips, provider switches, presets and comparison tabs; arrow keys move between comparison tabs.
