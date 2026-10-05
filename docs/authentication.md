---
outline: deep
title: Authentication
description: Authenticate FastAPI users with cookie sessions, opaque API tokens or an OAuth 2.1 authorization server using fastapi-startkit-auth.
keywords: authentication, fastapi auth, sessions, csrf, api tokens, oauth2, oauth 2.1, pkce, fastapi-startkit-auth
---

# Authentication

`fastapi-startkit-auth` gives a FastAPI app three ways to authenticate users:

- cookie sessions for server-rendered pages and same-site SPAs
- opaque API tokens for mobile apps, CLIs and scripts
- an OAuth 2.1 authorization server for clients you don't own

The package is split into four providers. `AuthProvider` is always required.
Register only the feature providers you use. Each one has its own config,
routes and migrations.

| Provider | Config | Adds | Tables |
| --- | --- | --- | --- |
| `AuthProvider` (required) | `AuthConfig` | Guards, user providers, password hashing and resets, the `Auth` facade, the `current_user` / `auth` / `require_scopes` dependencies | — |
| `AuthSessionProvider` | `SessionConfig` | The session cookie, the `session` guard driver, CSRF protection, the `Session` facade | `sessions` |
| `AuthOAuth2Provider` | `OAuth2Config` | The `oauth2` guard driver, the `/oauth/*` endpoints, the `auth:oauth2:client` command | `oauth_access_tokens`, `oauth_refresh_tokens`, `oauth_auth_codes`, `oauth_clients` |
| `AuthApiTokenProvider` | `ApiTokenConfig` | The `token` guard driver, the `ApiToken` facade, optional SPA mode | `personal_api_tokens` |

## Contents

- [Installation](#installation)
- [Registering the providers](#registering-the-providers)
- [Core: AuthProvider](#core-authprovider)
- [Sessions: AuthSessionProvider](#sessions-authsessionprovider)
- [API tokens: AuthApiTokenProvider](#api-tokens-authapitokenprovider)
- [OAuth 2.1: AuthOAuth2Provider](#oauth-21-authoauth2provider)
- [Stores](#stores)
- [Migrations](#migrations)
- [Protecting routes](#protecting-routes)
- [Errors](#errors)

## Installation

Install the package with your package manager:

::: code-group

```sh [uv]
uv add fastapi-startkit-auth
```

```sh [pip]
pip install fastapi-startkit-auth
```

:::

The package runs standalone on any FastAPI app. Add an extra for the database
stores and the Startkit integration:

| Extra | Installs | Use it for |
| --- | --- | --- |
| `startkit` | `fastapi-startkit[database]` (Python 3.12+) | `store="database"` and registering the providers in a Startkit `Application` |
| `masoniteorm` | `masonite-orm` | The `masoniteorm` user provider on a standalone app |

```sh
uv add "fastapi-startkit-auth[startkit]"
```

## Registering the providers

Register `AuthProvider` first. The feature providers add to the `AuthManager`
it builds. If a feature provider comes first, it fails with
`Register AuthProvider before AuthSessionProvider.` (standalone) or
`List AuthProvider before AuthSessionProvider in the application providers.`
(Startkit).

### Standalone FastAPI

Construct each provider with its config and call `register(app)`:

```python
from fastapi import FastAPI
from fastapi_startkit_auth import (
    ApiTokenConfig,
    AuthApiTokenProvider,
    AuthOAuth2Provider,
    AuthProvider,
    AuthSessionProvider,
    OAuth2Config,
    SessionConfig,
)

from myapp.auth import Config  # an AuthConfig subclass, see below

app = FastAPI()
AuthProvider(Config).register(app)
AuthSessionProvider(SessionConfig()).register(app)
AuthApiTokenProvider(ApiTokenConfig()).register(app)
AuthOAuth2Provider(OAuth2Config(key="change-me-to-a-long-random-secret")).register(app)
```

`AuthProvider.register(app)` adds the auth middleware and the `AuthError`
exception handler, warms the user providers up at startup, and mounts the
password-reset routes when `AuthConfig.passwords` is set. A standalone app
doesn't need the Startkit framework installed.

### Startkit

List the providers in the application, each paired with its config:

```python
from fastapi_startkit import Application
from fastapi_startkit_auth import (
    ApiTokenConfig,
    AuthApiTokenProvider,
    AuthOAuth2Provider,
    AuthProvider,
    AuthSessionProvider,
    OAuth2Config,
    SessionConfig,
)

from config.auth import Config

app = Application(
    providers=[
        (AuthProvider, Config),
        (AuthSessionProvider, SessionConfig(store="database")),
        (AuthApiTokenProvider, ApiTokenConfig(store="database")),
        (AuthOAuth2Provider, OAuth2Config(key="change-me-to-a-long-random-secret")),
    ]
)
```

A provider listed without a config uses its config class's defaults. Under
Startkit:

- `AuthProvider` binds the manager as `auth_manager` in the container.
- On boot, `AuthProvider` installs the middleware and exception handler, then
  validates the configuration.
- Each feature provider publishes its own migrations under its own key:
  `auth-session`, `auth-api-token` (which also publishes `config/cors.py`) and
  `auth-oauth2`.
- `AuthOAuth2Provider` registers the `auth:oauth2:client` command.

```sh
python artisan provider:publish -p auth-session
python artisan provider:publish -p auth-api-token
python artisan provider:publish -p auth-oauth2
python artisan db:migrate
```

### Rules checked at startup

- Guards are built from their driver. A guard whose driver belongs to a provider
  you didn't register fails with `FeatureNotRegistered`, which names the
  provider to add. For example: `Guard 'web' uses the 'session' driver, which is
  not enabled; register AuthSessionProvider after AuthProvider.`
- SPA mode (`ApiTokenConfig.stateful_origins`) requires `AuthSessionProvider`.
  `ApiTokenConfig.session_guard` must name a session guard.
- OAuth2 works without sessions. A resource server, or a server that only issues
  client-credentials tokens, needs only `AuthProvider` and `AuthOAuth2Provider`.

## Core: AuthProvider

`AuthConfig` declares the guards, user providers and password brokers.
Write it as a class whose attributes are the settings; a plain dict with the
same keys also works.

```python
from fastapi_startkit_auth import AuthConfig
from fastapi_startkit_auth.config import ApiTokenGuard, OAuth2Guard, SessionGuard

from myapp.models import User


class Config(AuthConfig):
    default = {"guard": "web", "passwords": "users"}
    guards = {
        "web": SessionGuard(provider="users"),
        "api": ApiTokenGuard(provider="users"),
        "oauth": OAuth2Guard(provider="users"),
    }
    providers = {"users": {"driver": "masoniteorm", "model": User}}
    passwords = {"users": {"provider": "users", "expire": 60, "throttle": 60}}
    bcrypt_rounds = 12
```

| Setting | Default | Meaning |
| --- | --- | --- |
| `default` | `{"guard": "web", "passwords": "users"}` | The guard used when none is named, and the broker the reset routes use |
| `guards` | `{}` | Maps a guard name to a guard spec |
| `providers` | `{}` | Maps a user provider name to a provider spec |
| `passwords` | `{}` | Maps a broker name to a broker spec; setting it mounts the `/password/*` routes |
| `bcrypt_rounds` | `12` | Cost for new password hashes |
| `password_reset_notifier` | `None` | Called as `notifier(email, token)` to deliver a reset token |
| `debug_expose_reset_token` | `False` | Returns the reset token in the `/password/email` response. Local development only |

### Guards

A guard spec is a dataclass from `fastapi_startkit_auth.config`, or a dict with a
`driver` key:

| Dataclass | Dict | Feature provider |
| --- | --- | --- |
| `SessionGuard(provider=...)` | `{"driver": "session", "provider": ...}` | `AuthSessionProvider` |
| `ApiTokenGuard(provider=...)` | `{"driver": "token", "provider": ...}` | `AuthApiTokenProvider` |
| `OAuth2Guard(provider=..., audience=None)` | `{"driver": "oauth2", "provider": ...}` | `AuthOAuth2Provider` |

`"passport"` is an alias of `"oauth2"`, and it is the driver used when a dict
has no `driver` key. An OAuth2 guard with an `audience` accepts only tokens bound
to that resource (see [Resource indicators](#resource-indicators)).

### User providers

| `driver` | Meaning |
| --- | --- |
| `masoniteorm` / `orm` / `model` | Wraps a model exposing `find(id)` and `where(field, value).first()` |
| `async_model` | The same, for async ORMs |
| `memory` | An in-memory store for tests and demos |
| `instance` | A ready `UserProvider` passed as `{"instance": ...}` |
| `factory` | A zero-argument callable returning a `UserProvider` |

The model drivers accept `username_field` (default `email`), `password_field`
(default `password`), `password_key`, `id_field` and `is_active`. The
`is_active` value is an attribute name or a `callable(user) -> bool`. Inactive
users can't log in, authenticate, refresh or exchange a code, and they
introspect as inactive.

Any object implementing `retrieve_by_id`, `retrieve_by_credentials`,
`validate_credentials`, `get_identifier` and `update_password` is a valid
provider. When one of its methods is `async def`, the manager builds the async
guards, grants and password broker.

### Password resets

When `AuthConfig.passwords` is set, `AuthProvider` mounts two routes:

| Route | Body | Response |
| --- | --- | --- |
| `POST /password/email` | `{"email": ...}` | The same generic answer for known and unknown emails |
| `POST /password/reset` | `{"email": ..., "token": ..., "password": ...}` | `{"status": "password reset"}` |

The reset token never appears in the response, unless
`debug_expose_reset_token` is set. It reaches the user through
`password_reset_notifier`.

### The Auth facade

`Auth` works on the class inside any request, or as a dependency through
`Depends(Auth.scoped)`. The package ships no login routes; write your own:

```python
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi_startkit_auth import Auth, InvalidSession

app = FastAPI()  # with AuthProvider and AuthSessionProvider registered


class Credentials(BaseModel):
    email: str
    password: str


@app.post("/login")
def login(payload: Credentials):
    if not Auth.attempt(payload.model_dump()):
        raise InvalidSession("Invalid credentials.")
    return {"ok": True}


@app.post("/logout")
def logout():
    Auth.logout()
    return {"ok": True}
```

| Method | Does |
| --- | --- |
| `Auth.attempt(credentials, guard=None)` | Checks credentials and starts a session; `False` on any failure |
| `Auth.login(user_or_id, guard=None)` | Starts a session for a user or id, regenerating the session id |
| `Auth.logout(guard=None)` | Ends the session |
| `Auth.validate(credentials, guard=None)` | Returns the user if the credentials are valid, without logging in; otherwise `None` |
| `Auth.user(guard=None)` / `Auth.id(...)` / `Auth.check(...)` | The current user, its id, or whether one is authenticated. Never raises |
| `Auth.guard(name=None)` | The guard object |

With an async user provider or session store, use `AsyncAuth`. It has the same
methods as coroutines. `Auth` refuses an async session guard with a
`RuntimeError` that points at `AsyncAuth`.

## Sessions: AuthSessionProvider

```python
SessionConfig(
    store="memory",           # "memory", "database" or "instance"
    connection=None,          # ORM connection name for store="database"
    instance=None,            # a ready SessionStore for store="instance"
    cookie="startkit_session",
    ttl=7200,                 # absolute lifetime in seconds
    idle_ttl=None,            # idle timeout in seconds
    http_only=True,
    same_site="lax",
    secure=True,              # a warning is emitted when False
    domain=None,
    path="/",
    purge_interval=300,
    csrf_cookie="XSRF-TOKEN",
    csrf_header="X-XSRF-TOKEN",
    csrf_field="_token",
    csrf_exempt_paths=[],
)
```

Sessions back the `session` guard driver, `Auth.login` and `Auth.logout`.

The `Session` facade works inside a request:

| Method | Does |
| --- | --- |
| `Session.id()` | The current session id, or `None` |
| `Session.token()` | The CSRF token, starting a guest session if needed |
| `await Session.regenerate()` | Issues a new session id and keeps the data |
| `await Session.invalidate()` | Destroys the session and clears the cookie |

### CSRF protection

CSRF protection is always on when sessions are enabled. An unsafe request
(`POST`, `PUT`, `PATCH`, `DELETE`) that carries a live session must send the
session's CSRF token in the `X-XSRF-TOKEN` header, or in the `_token` field of
an HTML form. Otherwise it gets `403 csrf_token_mismatch`.

- The token is delivered in the readable `XSRF-TOKEN` cookie.
- Requests without a session cookie, such as bearer-token clients, are exempt.
- `/oauth/token`, `/oauth/introspect` and `/oauth/revoke` are always exempt.
- To exempt more paths, list them in `csrf_exempt_paths`. A trailing `*` matches
  a prefix.

## API tokens: AuthApiTokenProvider

```python
ApiTokenConfig(
    store="memory",            # "memory", "database" or "instance"
    connection=None,
    instance=None,
    header="Authorization",    # read as "Bearer {id}|{secret}"
    ttl=None,                  # default lifetime in seconds; None never expires
    purge_interval=300,
    stateful_origins=[],       # non-empty turns on SPA mode
    session_guard="web",
)
```

API tokens are opaque strings of the form `{id}|{secret}`. Only a hash of the
secret is stored, so the plaintext is available once, at creation. Issue tokens
with the `ApiToken` facade. Its methods are awaitable for sync and async stores
alike:

```python
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi_startkit_auth import ApiToken, Auth, InvalidSession

app = FastAPI()  # with AuthProvider and AuthApiTokenProvider registered


class Credentials(BaseModel):
    email: str
    password: str


@app.post("/mobile/token")
async def mobile_token(payload: Credentials):
    user = Auth.validate(payload.model_dump(), guard="api")
    if user is None:
        raise InvalidSession("Invalid credentials.")
    token = await ApiToken.create(user, name="iPhone", abilities=["posts:read"], guard="api")
    return {"token": token.plain_text}
```

| Method | Does |
| --- | --- |
| `await ApiToken.create(user_or_id, name=None, abilities=None, expires_at=None, guard=None)` | Returns a `NewApiToken`; `.plain_text` is the token |
| `await ApiToken.tokens(user_or_id, guard=None)` | The user's tokens |
| `await ApiToken.revoke(token_id)` | Revokes one token |
| `await ApiToken.revoke_all(user_or_id, guard=None)` | Revokes all of the user's tokens |

Abilities become the context's scopes, so `require_abilities` (an alias of
`require_scopes`) enforces them.

### SPA mode

A non-empty `stateful_origins` turns on SPA mode:

- Token guards first try the session cookie of the `session_guard`, then fall
  back to the token header.
- `GET /__auth__/csrf-cookie` primes a SPA with a session and a CSRF cookie.
- On unsafe requests, the CSRF middleware rejects an `Origin` that is not in
  `stateful_origins` before it checks the token.

SPA mode requires `AuthSessionProvider`.

```python
AuthApiTokenProvider(ApiTokenConfig(stateful_origins=["https://app.example.com"])).register(app)
```

## OAuth 2.1: AuthOAuth2Provider

```python
from fastapi_startkit_auth import OAuth2Config, OAuthClientsConfig, OAuthTokensConfig

OAuth2Config(
    key="change-me-to-a-long-random-secret",  # JWT signing key; required in production
    algorithm="HS256",
    access_token_ttl=3600,
    refresh_token_ttl=60 * 60 * 24 * 14,
    personal_access_token_ttl=60 * 60 * 24 * 365,
    authorization_code_ttl=600,
    issuer="https://auth.example.com",        # stamps and verifies `iss`
    resources=["https://api.example.com"],    # RFC 8707 resource indicators
    scopes={"read": "Read your data"},        # scope catalog; empty accepts any scope
    default_scopes=[],                        # applied when a request names none
    pkce_methods=["S256"],
    require_pkce=True,
    require_redirect_uri=True,
    grant_types=["authorization_code", "client_credentials", "refresh_token"],
    authorization_guard=None,                 # guard that identifies the approving user
    tokens=OAuthTokensConfig(store="memory"),
    clients=OAuthClientsConfig(store="database"),
)
```

| Setting | Default | Meaning |
| --- | --- | --- |
| `key` | `None` | JWT signing secret. Without it an ephemeral key is generated with a warning, and tokens die on restart |
| `issuer` | `None` | Adds an `iss` claim and requires it on decode. Also used as the `iss` in authorization responses and metadata (otherwise the request's base URL is used) |
| `resources` | `[]` | Resources a token may be bound to. A granted resource becomes the token's `aud` |
| `scopes` | `{}` | Scope catalog (name to description). When set, unknown scopes fail with `invalid_scope`. Never list `"*"`, which grants every ability |
| `default_scopes` | `[]` | Scopes used when a request names none |
| `pkce_methods` | `["S256"]` | Accepted PKCE methods. A missing `code_challenge_method` means `plain` |
| `require_pkce` | `True` | Every authorization request needs a `code_challenge` |
| `require_redirect_uri` | `True` | Authorization requests must send a registered `redirect_uri` |
| `grant_types` | `["authorization_code", "client_credentials", "refresh_token"]` | Enabled grants. Add `"password"` to enable the legacy password grant and `POST /token` |
| `authorization_guard` | `None` | Guard used to identify the user on `/oauth/authorize`. Defaults to the default guard |
| `tokens` | `OAuthTokensConfig(store="memory")` | Where access tokens, refresh tokens and codes live |
| `clients` | `OAuthClientsConfig(store="database")` | Where clients live |

`tokens` and `clients` also accept a dict, for example
`clients={"store": "memory"}`.

### Deprecated: OAuth settings on AuthConfig

Earlier versions read the OAuth settings from `AuthConfig`. These attributes
are still honoured as a fallback, each with a `DeprecationWarning`:

`key`, `algorithm`, `access_token_ttl`, `refresh_token_ttl`,
`personal_access_token_ttl`, `authorization_code_ttl`, `tokens`, `issuer`,
`resources`, `scopes`, `pkce_methods`, `require_pkce`.

A value set explicitly on `OAuth2Config` always wins over the legacy attribute.
Move these settings to `OAuth2Config`; the fallback will be removed in a future
release.

### Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 server metadata |
| `GET /oauth/authorize` | Validates an authorization request for your consent screen |
| `POST /oauth/authorize` | Issues a code after consent (`"approved": true`). Returns `code`, `state`, `iss` and `redirect_to` |
| `POST /oauth/token` | Token endpoint: `authorization_code`, `refresh_token`, `client_credentials`, plus `password` when enabled |
| `POST /token` | Simple password-grant endpoint, only when `"password"` is enabled |
| `POST /oauth/introspect` | RFC 7662 introspection. Requires a confidential client |
| `POST /oauth/revoke` | RFC 7009 revocation. Requires client authentication |
| `GET /oauth/tokens` | Lists the current user's OAuth tokens |
| `DELETE /oauth/tokens` | Revokes all of the current user's OAuth tokens |
| `DELETE /oauth/tokens/{jti}` | Revokes one of them |
| `POST /oauth/personal-access-tokens` | Creates a personal access token (`name`, `scopes`, `ttl`) |
| `GET /oauth/personal-access-tokens` | Lists the user's active personal access tokens |
| `DELETE /oauth/personal-access-tokens` | Revokes all of them |
| `DELETE /oauth/personal-access-tokens/{jti}` | Revokes one |

Clients authenticate with HTTP Basic (`client_secret_basic`) or with form fields
(`client_secret_post`), never both in one request. Public clients send only
`client_id`. Every token response and error carries `Cache-Control: no-store`.

There are no HTTP routes for managing clients. The former `/oauth/clients`
routes were removed. Create clients as described in [Clients](#clients).

### Clients

A client is confidential (it has a secret) or public (an SPA or native app,
with no secret and PKCE required). An empty `grant_types` allows every enabled
grant, and an empty `scopes` allows every catalog scope. A non-empty `scopes`
limits what the client may request: anything outside it, including
`default_scopes` filled in for a request naming none, fails with
`invalid_scope`. `"*"` is not expanded when matching the allow-list, but a
token granted `"*"` passes every `require_scopes` check, so never give a client
`"*"` (the command refuses it). Tightening a client's allow-list is not
retroactive: refresh tokens it already holds keep their granted scopes until
their family expires or is revoked (a refresh can only narrow scopes, never widen
them).

Under Startkit, create clients with the command:

```sh
python artisan auth:oauth2:client --name "My App" --redirect-uri https://app.example.com/callback
python artisan auth:oauth2:client --public --name "My SPA" \
  --redirect-uri https://spa.example.com/callback --redirect-uri http://localhost:5173/callback \
  --scopes "read write"
```

The command:

- prompts for anything missing
- requires absolute redirect URIs without fragments
- creates the client with the `authorization_code` and `refresh_token` grants
- limits it to `--scopes` (repeatable or space-separated, checked against the
  scope catalog); without it the client may request any scope
- prints the secret once, for confidential clients

In code, use the manager's client repository. Each call returns the client and
the plaintext secret, which is `None` for a public client:

```python
manager = app.state.auth_manager  # or container.make("auth_manager") under Startkit

client, secret = await manager.client_repository.register(
    name="reporting",
    redirect_uris=[],
    confidential=True,
    grant_types=["client_credentials"],
    scopes=["reports:read"],  # empty or omitted: any scope
    provider=None,  # an AuthConfig.providers name, for multi-provider apps
)
```

With the default `OAuthClientsConfig(store="database")`, clients live in the
`oauth_clients` table through `OrmClientRepository`; `store="memory"` uses
`InMemoryClientRepository`. Both are async, so `await` their methods. An async
client store makes the manager build the async refresh and authorization-code
grants.

### Authorization code with PKCE

1. **Validate the request (optional).** Your consent page can call
   `GET /oauth/authorize` with `client_id`, `response_type=code`,
   `redirect_uri`, `scope`, `state`, `code_challenge`,
   `code_challenge_method=S256` and an optional `resource`. It returns the
   client name and scopes to show, with `"requires_approval": true`.
2. **Issue the code.** Once the user approves, send the same fields to
   `POST /oauth/authorize` as JSON, with `"approved": true`. Consent is
   mandatory: without `approved: true` the request fails with `access_denied`.
   The user is resolved through `authorization_guard`. A session-backed request
   also needs the CSRF header. The response contains `code`, `state` and `iss`
   (RFC 9207). With a `redirect_uri` it also contains
   `redirect_to = <redirect_uri>?code=...&iss=...&state=...`.
3. **Exchange the code.** The client posts to `POST /oauth/token` with
   `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier` and
   `client_id`. A confidential client must also authenticate.

PKCE formats follow RFC 7636. An S256 challenge is 43 base64url characters, and
a verifier is 43 to 128 unreserved characters. Codes are single-use and expire
after `authorization_code_ttl`. A `response_type` other than `code` fails with
`unsupported_response_type`.

### Client credentials

Only confidential clients may use `grant_type=client_credentials`. A public
client gets `unauthorized_client`, and a revoked or unknown client gets
`invalid_client`. The token has no user, so `current_user` and `auth` reject it
with 401. `require_scopes` accepts it.

### Refresh tokens

Refresh tokens are opaque, rotate on every use, and belong to a family. The
family is the chain of tokens that descends from one grant.

- **Client binding.** A refresh token remembers the client it was issued to.
  Refreshing it requires that client's `client_id`, plus its secret when the
  client is confidential. Without a `client_id` the request fails with
  `invalid_client`. With a different client it fails with `invalid_grant`.
- **Unbound tokens.** Only the password grant issues tokens with no client.
  They are accepted only while `"password"` is in `grant_types`, and only when
  presented without client credentials.
- **Scopes and resource.** A refresh may narrow the scopes. It may not widen
  them or change the resource.

**Reuse detection.** Presenting a refresh token that was already rotated out is
treated as theft. It fails with `invalid_grant` and revokes the token's whole
family, so the attacker and the legitimate client must both start over.

Replaying a used token revokes its whole family whoever presents it: the client
it was issued to, any other successfully authenticated client, or (for an
unbound password-grant token) no client at all. A used client-bound token
presented with no `client_id` fails with `invalid_client` before reaching the
grant, so the family is left intact; a request whose client credentials fail
also gets `invalid_client` and changes nothing. Presenting an unused token
through the wrong client is rejected with `invalid_grant` and leaves the family
intact.

Rotation and code redemption are atomic. Under concurrent requests exactly one
wins, including across workers with the database store.

### Introspection and revocation

`POST /oauth/introspect` (RFC 7662) requires a confidential client.

- For an active access token it returns `active`, `scope`, `client_id`, `sub`,
  `token_type`, `exp`, `iat` and `jti`, plus `aud` and `iss` when present.
- Refresh tokens are introspectable too (`token_type: "refresh_token"`).
- Revoked, expired or unknown tokens return `{"active": false}`, as do tokens
  whose user is gone or inactive.

`POST /oauth/revoke` (RFC 7009) needs `token`, an optional `token_type_hint`,
and client authentication. It revokes the access or refresh token together with
its access/refresh chain, but only when the token belongs to the calling
client. Unbound tokens are revocable only while the password grant is enabled.
Following the RFC, the endpoint answers `200 {"revoked": true}` even for
unknown or foreign tokens, so nothing leaks.

`GET /oauth/tokens` lists the authenticated user's OAuth access tokens.
`DELETE /oauth/tokens` revokes all of them, and `DELETE /oauth/tokens/{jti}`
revokes one, each with its refresh chain. Personal access tokens are managed
separately under `/oauth/personal-access-tokens`.

### Resource indicators

Clients may send a `resource` (RFC 8707) to `/oauth/authorize` and
`/oauth/token`. It must be listed in `OAuth2Config.resources`, and only one is
allowed per request. Otherwise the request fails with `invalid_target`.

The code and the refresh token remember the resource, and the access token
carries it as `aud`. An `OAuth2Guard(audience=...)` accepts only tokens for its
audience. Guards without an audience refuse resource-bound tokens.

### Multiple user providers

Register a client with `provider="admins"` to make it act for that provider's
users:

- The password grant authenticates against that provider.
- Refresh, code exchange and introspection re-check the token owner against it.
- `POST /oauth/authorize` rejects a client bound to a different provider than
  the authenticated user's, with `unauthorized_client`.

### Legacy password grant

Add `"password"` to `grant_types` to enable `grant_type=password` on
`/oauth/token` and the `POST /token` endpoint. While it is disabled, both answer
`unsupported_grant_type`.

## Stores

Every persistent piece of state has a store setting with the same names:

| Config | Default `store` | Persistent store |
| --- | --- | --- |
| `SessionConfig` | `"memory"` | `"database"` → `OrmSessionStore`, table `sessions` |
| `ApiTokenConfig` | `"memory"` | `"database"` → `OrmApiTokenRepository`, table `personal_api_tokens` |
| `OAuthTokensConfig` (`OAuth2Config.tokens`) | `"memory"` | `"database"` → `OrmTokenRepository`, tables `oauth_access_tokens`, `oauth_refresh_tokens`, `oauth_auth_codes` |
| `OAuthClientsConfig` (`OAuth2Config.clients`) | `"database"` | `"database"` → `OrmClientRepository`, table `oauth_clients` |

- **`"database"`** is the persistent store. It uses the fastapi-startkit ORM
  (`pip install "fastapi-startkit-auth[startkit]"`). `connection` names a
  database connection; leave it out to use the default one. Run the
  [migrations](#migrations) first.
- **`"memory"`** keeps state in the process. Use it for tests and
  single-process demos. It is lost on restart.
- **`"instance"`** uses a ready-made store object passed as `instance=`.
- **`"orm"`** is a deprecated alias of `"database"`. It still works on all four
  configs, but emits a `DeprecationWarning` and will be removed.
- The former `"sql"` and `"async_sql"` stores were removed. Configuring one
  for sessions, API tokens or OAuth tokens raises a `ValueError` that points at
  `"database"`.

```python
SessionConfig(store="database")
ApiTokenConfig(store="database", connection="auth")
OAuth2Config(
    tokens=OAuthTokensConfig(store="database"),
    clients=OAuthClientsConfig(store="memory"),  # opt out of the clients table
)
```

The database stores are async, so the manager builds the async guards, grants
and token service automatically. Use `AsyncAuth` for session login and logout
with `SessionConfig(store="database")`.

## Migrations

Each provider publishes only its own migrations. All of them are reversible.

| Provider | Migrations |
| --- | --- |
| `AuthSessionProvider` | `create_sessions_table` |
| `AuthApiTokenProvider` | `create_personal_api_tokens_table` |
| `AuthOAuth2Provider` | `create_oauth_access_tokens_table`, `create_oauth_refresh_tokens_table`, `create_oauth_auth_codes_table`, `add_resource_to_oauth_tables`, `create_oauth_clients_table`, `add_family_id_to_oauth_refresh_tokens_table` |

The two newest OAuth migrations are additive. They change no existing column, so
apps upgrading from v0.6.x only need to publish and run them:

- `2026_10_04_000001_create_oauth_clients_table` creates the `oauth_clients`
  table that the default client store uses.
- `2026_10_04_000002_add_family_id_to_oauth_refresh_tokens_table` adds a
  nullable, indexed `family_id` column to `oauth_refresh_tokens`, used for reuse
  detection.

```sh
python artisan provider:publish -p auth-oauth2
python artisan db:migrate
python artisan db:migrate:rollback   # reverts the last batch
```

## Protecting routes

```python
from fastapi import Depends
from fastapi_startkit_auth import auth, current_user, optional_user, require_abilities, require_scopes


@app.get("/me")
def me(user=Depends(current_user)):           # 401 unless a user is authenticated
    return user


@app.get("/maybe")
def maybe(user=Depends(optional_user)):       # the user, or None
    return {"user": user}


@app.get("/reports")
def reports(ctx=Depends(require_scopes("reports:read"))):   # 403 insufficient_scope otherwise
    return {"client": ctx.client_id}
```

- `require_scopes("a", "b")` requires every listed scope.
  `require_scopes("a", "b", mode="any")` requires at least one.
- `require_abilities` is an alias of `require_scopes`.
- `"*"` satisfies any scope.
- `auth` returns the `AuthContext` (`user`, `scopes`, `client_id`, `jti`,
  `can(...)`, `can_any(...)`, `can_all(...)`) and rejects user-less tokens.

These dependencies resolve the request through the **default guard**
(`AuthConfig.default["guard"]`). To read another guard in a route, use the
facade, for example `Auth.user("api")` or `Auth.check("api")`.

## Errors

Every `AuthError` becomes an OAuth-style JSON body,
`{"error": ..., "error_description": ...}`, with `Cache-Control: no-store`.

| Error | Status |
| --- | --- |
| `invalid_request`, `invalid_grant`, `invalid_scope`, `invalid_target`, `unsupported_grant_type`, `unsupported_response_type`, `unauthorized_client`, `access_denied` | 400 |
| `invalid_client` (with `WWW-Authenticate: Basic`) | 401 |
| `invalid_token`, `invalid_session` (with `WWW-Authenticate: Bearer`) | 401 |
| `insufficient_scope`, `csrf_token_mismatch` | 403 |
| `throttled` | 429 |
