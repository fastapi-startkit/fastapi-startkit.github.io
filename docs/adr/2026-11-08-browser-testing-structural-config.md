# Browser testing page and structural config section (v0.75.0)

- Date: 2026-11-08
- Status: Accepted

## Problem

Framework v0.75.0 shipped three changes with no documentation:

- fastapi-startkit-framework#352 adds `fastapi_startkit.playwright` (fluent async browser tests, the pytest plugin) and `DatabaseTruncation` (framework ADR 065; the task brief called it 063, but it was renumbered before merge).
- fastapi-startkit-framework#353 adds `example/browser-testing` (framework ADR 066).
- fastapi-startkit-framework#293 adds the `AppSettings` and `DatabaseSettings` protocols and `ensure_config` (framework ADR 027).

## Alternatives

- **Browser testing as a section of FastAPI Testing.** That page is about `HttpTestCase` over ASGI, and the browser API is larger than the rest of the page. Rejected in favour of its own page.
- **Structural config on the Database pages.** The protocols cover the application config as well, and `ensure_config` is generic. Rejected: it goes on Configuration, and Database pages are another engineer's v0.75.0 area.

## Decision

- New `docs/testing/browser.md`, linked in the Testing sidebar group after Database Testing. It covers installation (the `playwright` extra and `playwright install`), the pytest loop-scope setup, `BrowserTestCase`/`get_application()`, lazy page chains and the unawaited-chain error, browser and device configuration, element lookup rules, every interaction and assertion grouped as in ADR 065, readers and `page.playwright`, `DatabaseTruncation` and its attributes, `--headed`/`--inspect`/`.debug()`/screenshots, the three ini options, the example app, and the deferred features.
- `docs/testing/database.md` gets a tip pointing browser tests to `DatabaseTruncation`.
- `docs/configuration.md` gets "Config Classes Without a Base Class": the `AppSettings` and `DatabaseSettings` members, plain dataclass, plain class and `SimpleNamespace` configs, the default `migrations` fallback, the unused `migrations.table`, the `TypeError` messages, `ensure_config`, and when to keep the `Config` base (`env()` constructor kwargs and class-level defaults).

## Validation

- Every name, signature, default and message was checked against `v0.75.0` source and tests (`playwright/*.py`, `pytest_plugin.py`, `masoniteorm/testing/truncation.py`, `support/config/ensure.py`, `masoniteorm/providers/DatabaseProvider.py`, `tests/core/test_structural_config.py`).
- The configuration examples were run against v0.75.0, and their printed values and `TypeError` messages match the page.
- The chain, reader, key, frame, URL and unawaited-chain examples were run as browser tests on Chromium against v0.75.0.
- `npm run build` passes with no dead links.
