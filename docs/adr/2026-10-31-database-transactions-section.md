# Database transactions section

Date: 2026-10-31

## Problem

The database docs say nothing about transactions. The ORM on framework `main` supports `Connection.transaction()`, manual `begin_transaction` / `commit` / `rollback`, savepoints, named connections, and `after_commit` callbacks (framework ADR 006 and ADR 018). The only mention of transactions is on the Database Testing page.

## Alternatives

1. **A section on the Database overview page (chosen).** Keeps the sidebar unchanged and puts transactions next to connection setup, as Laravel's "Database: Getting Started" page does.
2. **A section on the Models page.** Transactions also cover `DB.table()` and raw statements, so they don't belong to models.
3. **A separate `docs/database/transactions.md` page.** Rejected on review: the docs shouldn't gain a new page for this.

## Decision

Option 1. A `## Database Transactions` section in `docs/database/index.md`, placed before "Example Application". It covers the context manager, rollback on exception, early commit/rollback through the transaction object, manual control, nested transactions, named connections, task scoping, `after_commit`, and how the testing mixins interact with transactions. It lists only behaviour present on framework `main`.

Two SQLite limitations found while verifying are documented as warnings rather than left out. With pysqlite/aiosqlite, `BEGIN` is deferred until the first write, so a savepoint that makes the first write is committed for real by `RELEASE`. That affects nested transactions and the `DatabaseTransaction` / `RefreshDatabase` test rollback. `after_commit` callbacks registered inside a test transaction never run, because the test's transaction is always rolled back.

## Implementation

- `docs/database/index.md`: the new section, with subsections at `###` and `####` so they nest in the page outline; `transactions` added to the page keywords.

## Validation

- Every code example was run against SQLite through a real `Application` with `DatabaseProvider`, in a scratch script outside the repo, using the framework on `main`. This includes the SQLite savepoint and test-mixin behaviour.
- `npm run docs:build` succeeds, and the section renders in `npm run docs:preview` with working outline and anchor links.
