---
outline: deep
title: Frontend Introduction
description: An introduction to frontend development with FastAPI Startkit, including Vite and Inertia support.
keywords: frontend, vite, inertia, fastapi
---
# Frontend
FastAPI Startkit lets you keep your frontend in the same codebase as your Python app. Your routes, templates, and frontend assets live in one project and deploy together, so you don't need a separate frontend repository or API layer to get started.

Best of all, the frontend layer is entirely opt-in. Until you add `ViteProvider` to your application, no frontend code is loaded and no routes or middleware are registered, even if the published Vite files are already on disk.

## Two ways to build

There are two ways to build your frontend, depending on how much structure you want the framework to provide.

### 1. Vite only — bring your own architecture

Register `ViteProvider` and you can use Vite with any frontend stack you like: React, Vue, Svelte, or plain TypeScript. Vite bundles your assets and serves HMR in development, while your server renders Jinja2 templates that load the bundled assets.

You decide how data gets from the server to the client, whether that's JSON endpoints, template-rendered state, or something else entirely.

- [Vite setup and configuration →](./vite)

### 2. Vite + Inertia — server-driven SPA

If you'd like a single-page app without building a separate API, add `InertiaProvider` alongside `ViteProvider`. Your controllers return a component name and props, and Inertia takes care of page transitions, partial reloads, and URL updates on the client.

- [Inertia setup and usage →](./inertia)

## Zero cost when unused

Both providers are opt-in. If you don't register `ViteProvider`, nothing from the frontend module is imported, so there's nothing to disable.
