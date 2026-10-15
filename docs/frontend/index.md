---
outline: deep
title: Frontend Introduction
description: Introduction to frontend development with Fastapi Startkit, including Vite and Inertia support.
keywords: frontend, vite, inertia, fastapi
---
# Frontend
Fastapi Startkit lets you keep your frontend in the same codebase as your Python app. Routes, templates, and frontend assets live in one project and deploy together, so you don't need a separate frontend repository or API layer to get started.

The frontend layer is opt-in. Until you add `ViteProvider` to your application, no frontend code is loaded and no routes or middleware are registered, even if the published Vite files are on disk.

## Two ways to build

### 1. Vite only — bring your own architecture

Register `ViteProvider` and use Vite with any frontend stack: React, Vue, Svelte, or plain TypeScript. Vite bundles your assets and serves HMR in development. Your server renders Jinja2 templates that load the bundled assets.

You decide how data gets from the server to the client: JSON endpoints, template-rendered state, or anything else.
- [Vite setup and configuration →](./vite)

### 2. Vite + Inertia — server-driven SPA

Add `InertiaProvider` alongside `ViteProvider` to build a single-page app without a separate API. Your controllers return a component name and props, and Inertia handles page transitions, partial reloads, and URL updates on the client.
- [Inertia setup and usage →](./inertia)

## Zero cost when unused

Both providers are opt-in. If `ViteProvider` is not registered, nothing from the frontend module is imported, and there is nothing to disable.
