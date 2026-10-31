# Database: Getting Started page

Date: 2026-10-31

## Problem

The Database overview page only covered installing the `database` extra, registering the provider, and a sample config. It didn't say which databases are supported, left out the driver extras (so `fastapi-startkit[database]` alone can't connect to anything), and had nothing on connection options, URLs, raw SQL, multiple connections, query logging, or transactions. The ORM on framework `main` supports all of those, and transactions are described in framework ADR 006 and ADR 018. The only mention of transactions was on the Database Testing page.

## Alternatives

1. **Expand the overview page to follow Laravel's "Database: Getting Started" (chosen).** One page with the same section order as laravel.com/docs/13.x/database, filled in only where the framework has the feature. The sidebar stays unchanged.
2. **New pages for raw SQL, configuration, and transactions.** Rejected on review: the docs shouldn't gain new pages for this.
3. **Mirror every Laravel section and mark missing features as "not supported".** This would fill the page with things readers can't use. Missing features go to the task report as gaps instead.

## Decision

Option 1. `docs/database/index.md` becomes "Database: Getting Started" with these sections:

- Introduction, with a table of supported databases, drivers, install extras, and config classes (SQLite/aiosqlite, MySQL/aiomysql, PostgreSQL/asyncpg). Any other driver raises `DriverNotFound`.
- Installation, with `database` plus a driver extra and a tip that MySQL 8's default auth needs `cryptography`.
- Setup, as before.
- Configuration, which covers the published config (now including PostgreSQL), `default` as a connection name, connection options and their env variables, SQLite file and `:memory:` databases, URLs (async driver schemes, the shared `DB_URL` pitfall), and pool tuning by overriding `engine_options()`.
- Project Structure, as before.
- Running SQL Queries, which covers `select`, `select_one`, `insert`, `update`, `delete`, and `statement` with `?` bindings, PostgreSQL `RETURNING`, multiple connections through `DB.connection(name)` and `__connection__`, and query logging with `echo` / `DB_ECHO`.
- Database Transactions, unchanged from the first version of this ADR: the context manager, rollback on exception, early commit/rollback, manual control, savepoints, named connections, task scoping, `after_commit`, and test mixins.

Behaviour that surprises readers is documented where it applies:

- `charset`, `collation`, `sslmode`, and `unix_socket` aren't passed to the driver.
- A literal `?` in SQL is treated as a placeholder.
- `insert` returns `None` on PostgreSQL.
- In-memory SQLite and `engine_options()` behave differently under `APP_ENV=testing`, where the engine uses `NullPool`.
- SQLite defers `BEGIN` until the first write, so a savepoint that makes the first write is committed for real.
- `after_commit` never runs inside test transactions.

Left out because the framework lacks them, and reported as gaps:

- read/write connections and the `sticky` option
- pooled PostgreSQL with a direct connection
- `DB.listen`, query-time monitoring, and Vitess
- `scalar`, named bindings, and `unprepared`
- the `db` CLI (`ShellCommand` exists but isn't registered)
- `db:show`, `db:table`, and `db:monitor`
- SQL Server and MariaDB
- `Model.on()` (it ignores its connection when a query method is chained)
- `DB.table().get()` without a model

## Implementation

- `docs/database/index.md`: the expanded page. The title is "Database: Getting Started", and the keywords add the database names and raw SQL. Subsections use `###` and `####` so they nest in the page outline.

## Validation

- Every code example ran in scratch scripts outside the repo, through a real `Application` with `DatabaseProvider`, using the framework on `main`. SQLite examples ran locally. The PostgreSQL examples (URL config, `RETURNING`, `insert` returning `None`, pool settings) ran against a throwaway `postgres:17` container, and the MySQL examples against a throwaway `mysql:8.0` container, which also confirmed the `cryptography` requirement.
- `npm run docs:build` succeeds. In `npm run docs:preview` the page has no console errors, the outline lists every section, and in-page anchors resolve.
