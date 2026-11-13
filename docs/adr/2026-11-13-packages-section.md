# Packages section for Authentication and Socialite

Date: 2026-11-13

## Problem

Authentication (`fastapi-startkit-auth`) and Socialite (the `socialite` extra, docs PR #123) sat in the Digging Deeper sidebar next to core framework features such as Validation and Cache. They are opt-in packages, and readers had no way to tell them apart from what ships with the core.

## Alternatives

1. **A `docs/packages/` directory with a Packages sidebar group (chosen).** URLs and the sidebar both show these are packages, and later packages have an obvious home.
2. **Only a Packages sidebar group, keeping the files in `docs/`.** Rejected. The URLs would disagree with the sidebar.
3. **Leave them under Digging Deeper.** Rejected. It hides the package boundary.

## Design

- `docs/authentication.md` → `docs/packages/authentication.md`
- `docs/socialite.md` → `docs/packages/socialite.md`
- A new Packages sidebar group, placed before Testing, lists Authentication and Socialite; both entries are removed from Digging Deeper.
- Neither page had relative links, and no other page linked to them, so no page content changed.

The old `/docs/authentication` URL stops resolving. VitePress has no built-in redirects and the site has no redirect mechanism, so none is added.

## Validation

- `npm run docs:build` succeeds with no dead links.
- `grep` finds no remaining `/docs/authentication` or `/docs/socialite` links.
