# v0.75.0: embeddings, mail, notifications and the Slack log driver

- Date: 2026-11-08
- Status: Accepted

## Problem

Framework v0.75.0 shipped AI embeddings with pgvector queries (framework #347), the mail and notification subsystems (#349), a rewritten Slack log driver (#327) and a PyPI README that installs with `uvx fastapi-startkit init` (#351). The site had no page for embeddings, mail or notifications, described the Slack driver without its new behaviour, and the installer options table lacked the defaults and the `.` directory.

## Alternatives

1. **Put pgvector columns and queries on the Database pages.** Rejected: another engineer is editing those pages for the same release, and the vector API is only useful together with embeddings.
2. **One combined "Mail & Notifications" page.** Rejected: Laravel keeps them apart, and notifications only use mail as one channel.
3. **Rewrite the whole logging page.** Rejected: open docs PR #113 renames `Logger` to `Log` on the same page; only the `slack` section is changed here.
4. **New `docs/ai/embeddings.md`, `docs/mail.md` and `docs/notifications.md`, a focused Slack section, and a small Getting Started edit.** Chosen.

## Decision

- `docs/ai/embeddings.md`, after Audio in the AI sidebar: providers and default models, install, config, `Embeddings.of(...).dimensions(n).generate(provider, model)`, `EmbeddingsResponse`, `Str.of(text).to_embeddings()`, `ensure_vector_extension_exists()`, `table.vector(...).index()` (HNSW, cosine), `vector_index()`, `list[float]` model fields, the five vector query methods (PostgreSQL only, cosine `<=>`, `TypeError` for text), and the fake with list, callable and stray modes plus the assertions.
- `docs/mail.md` and `docs/notifications.md`, after Broadcasting in Digging Deeper. Mail covers `MailProvider`, the env table, publishing `config/mail.py`, the `Mailable` methods, `build()`, `Mail.send`/`Mail.to`/`Mail.mailer`, `Mail.extend` and the `array` mailer for tests. Notifications cover the providers each channel needs, the table and migration, `via()`/`to_<channel>()`, `Notifiable`, the facade (imported under another name), on-demand routes, `MailMessage`, mail routing and `mailer`, the database channel and `notifications()`, and custom channels.
- `docs/logging.md`: only the `slack` section, describing `chat.postMessage`, the bearer header, channel names or IDs, the stderr fail-soft behaviour, `Retry-After`, and the removal of `find_channel`.
- `docs/getting-started.md`: defaults in the installer options table, `--no-interaction` needs a directory, `init .`, and `init --help`.
- Not documented, because the framework does not do them: embedding caching, queued notifications, mail templates, and mail or notification fakes.

## Validation

- Every API name and default was checked against the framework source at tag `v0.75.0` and its tests.
- Mail and notification examples were run against v0.75.0 with the `array` mailer and an in-memory SQLite notifications table. This showed that an on-demand recipient has no `name`, which the page now warns about.
- The embeddings fake, `to_embeddings` and assertion examples were run against v0.75.0. The vector grammar, schema and logging tests pass at the tag.
- `npm run build` passes with no dead links.
