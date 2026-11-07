# Auth package is async-only

Date: 2026-11-07

## Problem

`fastapi-startkit-auth` shipped two copies of most of its runtime: a sync `Auth`, `SessionGuard`, `PassportGuard`, `TokenGuard`, `ChainGuard`, `TokenService`, `ApiTokenManager`, `PasswordBroker`, four grants, `ModelUserProvider` and `UserProvider`, plus an `Async*` twin of each. The manager chose between them at runtime (`is_async_provider`, `has_async_methods`, `guard_is_async`), sync code refused async collaborators through `ensure_sync`/`AsyncMisconfiguration`, and the provider driver list had a separate `"async_model"`. The framework is async-only, so the sync half was dead weight. It also meant the public name `Auth` was the sync facade while every real app needed `AsyncAuth`. The authentication page documented both and told readers when to switch.

## Alternatives

1. **Remove every sync variant and give each `Async*` class the plain name (chosen).** One class per concept, one driver per provider type, and no runtime selection.
2. **Rename only `AsyncAuth` to `Auth` and keep the other sync/async pairs.** Rejected: it leaves the dual architecture, the selection logic and `AsyncMisconfiguration` in place, and readers still meet `Async*` names everywhere except the facade.
3. **Keep both and deprecate the sync classes.** Rejected: there is no sync support to deprecate towards. The sync classes only worked with sync stores, and every shipped store is async.

## Design

In `fastapi-startkit-auth` ([PR #41](https://github.com/fastapi-startkit/fastapi-startkit-auth/pull/41)):

| Removed sync class | Now named (formerly) |
|---|---|
| `Auth` | `Auth` (`AsyncAuth`) |
| `SessionGuard` | `SessionGuard` (`AsyncSessionGuard`) |
| `PassportGuard` | `PassportGuard` (`AsyncPassportGuard`) |
| `TokenGuard` | `TokenGuard` (`AsyncTokenGuard`) |
| `ChainGuard` | `ChainGuard` (`AsyncChainGuard`) |
| `TokenService` | `TokenService` (`AsyncTokenService`) |
| `ApiTokenManager` | `ApiTokenManager` (`AsyncApiTokenManager`) |
| `PasswordBroker` | `PasswordBroker` (`AsyncPasswordBroker`) |
| `PasswordGrant` | `PasswordGrant` (`AsyncPasswordGrant`) |
| `ClientCredentialsGrant` | `ClientCredentialsGrant` (`AsyncClientCredentialsGrant`) |
| `AuthorizationCodeGrant` | `AuthorizationCodeGrant` (`AsyncAuthorizationCodeGrant`) |
| `RefreshTokenGrant` | `RefreshTokenGrant` (`AsyncRefreshTokenGrant`) |
| `ModelUserProvider` | `ModelUserProvider` (`AsyncModelUserProvider`) |
| `UserProvider` protocol | `UserProvider` (`AsyncUserProvider`) |

- `user_is_active_async`, `find_user_async`, `active_user_async`, `ensure_owner_active_async` and `AuthManager.owner_provider_async` lose the suffix. `AuthManager.owner_provider` is now a coroutine.
- Removed outright: `AsyncMisconfiguration`, `ensure_sync`, `is_async_provider`, `guard_is_async`, `is_async`, `has_async_methods`, `PROVIDER_METHODS`, the `allow_async` flag of `active_check`, and the `"async_model"` provider driver (`"model"` covers it).
- `InMemoryUserProvider` lookups, verification and `update_password` are coroutines.
- `call()` stays, so user-supplied sync stores, listeners and `is_active` hooks still run in the threadpool.
- Custom user providers may implement their methods sync or async. Every guard, grant, the broker and the facade invoke provider methods through `call()`, so sync methods run in the threadpool. Rejecting sync providers would break existing custom providers and gain nothing, because `call()` already keeps them off the loop. The `UserProvider` protocol declares coroutines as the preferred shape.
- The `"model"` driver accepts sync and async models. `ModelUserProvider` runs `find`, `where(...).first()` and `save()` through `call()`, so a sync model's queries run in the threadpool and never block the event loop.
- Configuring `driver="async_model"` raises a `ValueError` that names `"model"` as the replacement, instead of the generic unknown-driver error.
- `Auth.guard(name)` is unchanged: a FastAPI dependency on the class, and the guard object on an instance.

In this repo, `docs/authentication.md`:
- drops the `async_model` driver row and the `AsyncAuth` paragraphs;
- makes the login, logout and mobile-token examples `async def` with `await Auth.*`;
- lists `await` on every facade method;
- explains what `Auth.guard` returns;
- drops the sentences about the manager building async variants.

**Breaking change.** Apps migrate by importing the plain names, awaiting every `Auth`, guard, provider, broker, grant and token-service call, and changing `driver="async_model"` to `driver="model"`. The auth package's `CHANGELOG.md` has the same note.

## Validation

- `uv run pytest` in `fastapi-startkit-auth` with Postgres: the full suite passes, and `ruff check` is clean.
- A test drives `ModelUserProvider` with a sync model and asserts that `find`, `where(...).first()` and `save()` all run off the event-loop thread. Another asserts the `async_model` migration error.
- The login/logout example from the page ran against the branch with class-level `Auth.attempt`, `Auth.logout` and `Auth.check`, plus `Depends(Auth.guard("web"))`, in a scratch test. A wrong password returns 401, a correct one sets the session, and the route returns 401 after logout.
- No page in this repo references a removed name.
