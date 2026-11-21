---
outline: deep
title: Frontend Introduction
description: An introduction to frontend development with FastAPI Startkit, including Vite and Inertia support.
keywords: frontend, vite, inertia, fastapi
---

# Frontend

The framework lets you keep your frontend in the same project as your Python application. Your routes, templates and frontend assets live together and deploy together, so you don't need a separate frontend repository or API to get started.

The frontend layer is opt-in. Until you register `ViteProvider` or `InertiaProvider`, the framework loads no frontend code and registers no templates, routes or middleware for it.

## Choosing a Stack {#two-ways-to-build}

You can build your frontend in two ways, depending on how much structure you want the framework to provide.

### Vite With Your Own Architecture

Register `ViteProvider` to bundle your assets with Vite. You can use any frontend stack: React, Vue, Svelte or plain TypeScript. Vite serves your assets with hot module replacement (HMR) while you develop, and your Jinja2 templates load the built files in production.

You decide how data gets from the server to the browser, whether that's JSON endpoints, values rendered into the template, or something else.

See [Vite](/docs/frontend/vite) to set it up.

### Vite With Inertia

Add `InertiaProvider` next to `ViteProvider` to build a single-page app without a separate API. Your controllers return a component name and props, and Inertia handles page transitions, partial reloads and URL updates in the browser.

See [Inertia](/docs/frontend/inertia) to set it up.

### Starting a New Project

When you create a project with `uvx fastapi-startkit@latest init`, pick React or Vue at the frontend question. The installer registers `ViteProvider` and `InertiaProvider` and writes the Vite config, the root template and a first page for you. See [Getting Started](/docs/getting-started#creating-a-project) for the installer options.
