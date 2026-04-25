# Frontend
Most Python backend frameworks treat the frontend as a completely separate concern — a different repo, a different team, a different deployment. That separation makes sense at scale, but it creates real friction when you are a solo developer or a small team trying to move fast.

Fastapi Startkit includes Vite support so you can build a **full-stack application in a single monolithic codebase** without reaching for a second framework. Your Python routes, templates, and 
frontend assets live together, share the same dev server workflow, and deploy as one unit.

**Nothing is forced on you.** Vite-related files may exist on disk after setup, but they are never loaded into memory and no routes or middleware are registered until you explicitly add `ViteProvider` to your application. If you never register it, the frontend layer has zero runtime cost — it simply does not exist from the application's perspective.

## Two ways to build

### 1. Vite only — bring your own architecture

Register `ViteProvider` and wire up Vite to whatever frontend stack you prefer: React, Vue, Svelte, plain TypeScript — your choice. Vite handles asset bundling and HMR in development. Your server renders Jinja2 templates that load the bundled assets.

This approach gives you full control. You decide how data flows between the server and the client — REST, JSON endpoints, template-rendered state, or anything else.
- [Vite setup and configuration →](./vite)

### 2. Vite + Inertia — server-driven SPA

Add `InertiaProvider` on top of `ViteProvider` and get a full server-driven SPA without writing a separate API. Your Python controllers return component names and props. Inertia handles page transitions, partial reloads, and keeps the URL in sync — all without a REST layer.

This is the fastest path to a polished, interactive full-stack application. You write controllers the same way you always have, and React (or Vue or Svelte) handles the rendering.
- [Inertia setup and usage →](./inertia)

---

## Zero cost when unused

Both approaches are fully opt-in at the provider level. If `ViteProvider` is not registered, nothing from the frontend module is ever loaded. The files may exist on disk — they are never read into memory. There is no performance penalty and no configuration required to "disable" it.
