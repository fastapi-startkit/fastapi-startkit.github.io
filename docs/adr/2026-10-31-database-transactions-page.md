# Database transactions page

Date: 2026-10-31

## Problem

The database docs have no page on transactions. The ORM on framework `main` supports `Connection.transaction()`, manual `begin_transaction` / `commit` / `rollback`, savepoints, named connections, and `after_commit` callbacks (framework ADR 006 and ADR 018). The only mention of transactions is on the Database Testing page.

## Alternatives

1. **A section on the Database overview page.** Keeps setup and transactions together, but the overview is about installation and configuration, and the section would be long.
2. **A section on the Models page.** Transactions also cover `DB.table()` and raw statements, so they don't belong to models.
3. **A separate `docs/database/transactions.md` page in the Database sidebar group (chosen).** Matches how Laravel's docs split the topic and keeps each page focused.

## Decision

Option 3. The page covers the context manager, rollback on exception, early commit/rollback through the transaction object, manual control, nested transactions, named connections, task scoping, `after_commit`, and how the testing mixins interact with transactions. It lists only behaviour present on framework `main`.

Two SQLite limitations found while verifying are documented as warnings rather than left out. With pysqlite/aiosqlite, `BEGIN` is deferred until the first write, so a savepoint that makes the first write is committed for real by `RELEASE`. That affects nested transactions and the `DatabaseTransaction` / `RefreshDatabase` test rollback. `after_commit` callbacks registered inside a test transaction never run, because the test's transaction is always rolled back.

## Implementation

- `docs/database/transactions.md`: the new page, in the tone and front-matter format of the other database pages.
- `.vitepress/config.mts`: a `Transactions` entry in the Database sidebar group.

## Validation

- Every code example was run against SQLite through a real `Application` with `DatabaseProvider`, in a scratch script outside the repo, using the framework on `main`. This includes the SQLite savepoint and test-mixin behaviour.
- `npm run docs:build` succeeds, and the page renders in `npm run docs:preview` with working sidebar and anchor links.
