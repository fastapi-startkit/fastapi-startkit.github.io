---
outline: deep
title: Authentication
description: Authenticate FastAPI users with cookie sessions, opaque API tokens or an OAuth 2.1 authorization server using fastapi-startkit-auth.
keywords: authentication, fastapi auth, sessions, csrf, api tokens, oauth2, oauth 2.1, pkce, fastapi-startkit-auth
---

# Authentication

Authentication lives in the [`fastapi-startkit-auth`](https://github.com/fastapi-startkit/fastapi-startkit-auth) package. It supports three ways to authenticate a request, and you can combine them:

- cookie sessions, for server-rendered pages and same-site SPAs
- opaque API tokens, for mobile apps, CLIs and scripts
- an OAuth 2.1 authorization server, for third-party clients

The package has four providers. `AuthProvider` is always required; add the other three only for the features you use. Each provider brings its own config, routes and migrations.

| Provider | Config | Adds | Tables |
| --- | --- | --- | --- |
| `AuthProvider` | `AuthConfig` | Guards, user providers, password hashing and resets, the `Auth` facade, the `current_user` / `auth` / `require_scopes` dependencies | — |
| `AuthSessionProvider` | `SessionConfig` | The session cookie, the `session` guard driver, CSRF protection, the `Session` facade | `sessions` |
| `AuthApiTokenProvider` | `ApiTokenConfig` | The `token` guard driver, the `ApiToken` facade, SPA mode | `personal_api_tokens` |
| `AuthOAuth2Provider` | `OAuth2Config` | The `oauth2` guard driver, the `/oauth/*` endpoints, the `auth:oauth2:client` command | `oauth_access_tokens`, `oauth_refresh_tokens`, `oauth_auth_codes`, `oauth_clients` |

## Installation

::: code-group

```sh [uv]
uv add fastapi-startkit-auth
```

```sh [pip]
pip install fastapi-startkit-auth
```

:::

The package works on any FastAPI app without the rest of the framework. Two extras add optional integrations:

| Extra | Installs | Needed for |
| --- | --- | --- |
| `startkit` | `fastapi-startkit[database]` (Python 3.12+) | The `database` stores, and registering the providers in a Startkit `Application` |
| `masoniteorm` | `masonite-orm` | The `masoniteorm` user provider on a standalone app |

```sh
uv add "fastapi-startkit-auth[startkit]"
```

## Registering the providers

Register `AuthProvider` before the feature providers, because they attach to the `AuthManager` it builds. Out of order, registration fails with `Register AuthProvider before AuthSessionProvider.` on a standalone app, or `List AuthProvider before AuthSessionProvider in the application providers.` under Startkit.

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
AuthOAuth2Provider(OAuth2Config(key="change-me-to-a-long-random-secret", clients={"driver": "memory"})).register(app)
```

`AuthProvider.register(app)` adds the auth middleware and the `AuthException` handler, warms up the user providers at startup, and mounts the password-reset routes when `AuthConfig.passwords` is set.

### Startkit

In a Startkit application, list each provider with its config. A provider listed without a config uses the defaults of its config class.

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
        (AuthSessionProvider, SessionConfig(driver="database")),
        (AuthApiTokenProvider, ApiTokenConfig(driver="database")),
        (AuthOAuth2Provider, OAuth2Config(key="change-me-to-a-long-random-secret")),
    ]
)
```

Under Startkit, `AuthProvider` also binds the manager as `auth_manager` in the container, and `AuthOAuth2Provider` registers the `auth:oauth2:client` command. Each feature provider publishes its migrations under its own key: `auth-session`, `auth-api-token` (which also publishes `config/cors.py`) and `auth-oauth2`.

```sh
python artisan provider:publish -p auth-session
python artisan provider:publish -p auth-api-token
python artisan provider:publish -p auth-oauth2
python artisan db:migrate
```

### Configuration checks

The configuration is validated on boot under Startkit, and on a standalone app when the middleware stack is built on the first request:

- A guard whose driver belongs to a provider you didn't register fails with `FeatureNotRegistered`, which names the missing provider: `Guard 'web' uses the 'session' driver, which is not enabled; register AuthSessionProvider after AuthProvider.`
- SPA mode (`ApiTokenConfig.stateful_origins`) needs `AuthSessionProvider`, and `ApiTokenConfig.session_guard` must name a session guard. On a standalone app, a missing `AuthSessionProvider` already fails in `AuthApiTokenProvider.register(app)`.

OAuth2 doesn't need sessions. A resource server, or a server that only issues client-credentials tokens, needs only `AuthProvider` and `AuthOAuth2Provider`.

## Configuration

`AuthConfig` declares the guards, user providers and password brokers. Write it as a subclass with the settings as class attributes, or pass a dict with the same keys.

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
| `guards` | `{}` | Guard name to guard spec |
| `providers` | `{}` | User provider name to provider spec |
| `passwords` | `{}` | Broker name to broker spec. Setting it mounts the `/password/*` routes |
| `bcrypt_rounds` | `12` | Cost of new password hashes |
| `password_reset_notifier` | `None` | Called as `notifier(email, token)` to deliver a reset token |
| `debug_expose_reset_token` | `False` | Returns the reset token in the `/password/email` response. For local development only |

### Guards

A guard spec is a dataclass from `fastapi_startkit_auth.config`, or a dict with a `driver` key:

| Dataclass | Dict | Requires |
| --- | --- | --- |
| `SessionGuard(provider=...)` | `{"driver": "session", "provider": ...}` | `AuthSessionProvider` |
| `ApiTokenGuard(provider=...)` | `{"driver": "token", "provider": ...}` | `AuthApiTokenProvider` |
| `OAuth2Guard(provider=..., audience=None)` | `{"driver": "oauth2", "provider": ...}` | `AuthOAuth2Provider` |

A dict without a `driver` key uses `"passport"`, an alias of `"oauth2"`. An OAuth2 guard with an `audience` accepts only tokens bound to that resource (see [Resource indicators](#resource-indicators)).

### User providers

| `driver` | Meaning |
| --- | --- |
| `masoniteorm` / `orm` / `model` | Wraps a model that has `find(id)` and `where(field, value).first()`, sync or async |
| `memory` | An in-memory store for tests and demos |
| `instance` | A ready `UserProvider`, passed as `{"instance": ...}` |
| `factory` | A zero-argument callable that returns a `UserProvider` |

The model drivers accept `username_field` (default `email`), `password_field` (default `password`), `password_key`, `id_field` and `is_active`. `is_active` is an attribute name or a `callable(user) -> bool`. An inactive user can't log in, authenticate, refresh a token or exchange a code, and their tokens introspect as inactive.

A model's methods can be sync or async. Async ones are awaited on the event loop, and sync `find`, `where(...).first()`, `save()` and `is_active` callables run in the threadpool, so a blocking ORM never stalls other requests. The old `async_model` driver is gone: configuring it raises a `ValueError` that points you to `model`.

To write your own provider, implement the `UserProvider` protocol from `fastapi_startkit_auth.providers.base`: `retrieve_by_id`, `retrieve_by_credentials`, `validate_credentials`, `update_password` and `get_identifier`. Optional `dummy_verify` and `is_active` methods are used when present. Guards, grants, the password broker and the `Auth` facade all await the provider, but its methods can be coroutines or plain functions. Sync ones run in the threadpool, just like user-supplied stores and hooks. Write them as coroutines when the backing store has an async client.

### Password resets

When `AuthConfig.passwords` is set, `AuthProvider` mounts two routes:

| Route | Body | Response |
| --- | --- | --- |
| `POST /password/email` | `{"email": ...}` | The same response for known and unknown emails |
| `POST /password/reset` | `{"email": ..., "token": ..., "password": ...}` | `{"status": "password reset"}` |

The token reaches the user only through `password_reset_notifier`. It is left out of the response unless `debug_expose_reset_token` is set.

## Logging users in

The package ships no login routes. Write them with the `Auth` facade, whose methods work on the class inside any request:

```python
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi_startkit_auth import Auth, AuthenticationException

app = FastAPI()  # with AuthProvider and AuthSessionProvider registered


class Credentials(BaseModel):
    email: str
    password: str


@app.post("/login")
async def login(payload: Credentials):
    if not await Auth.attempt(payload.model_dump()):
        raise AuthenticationException("Invalid credentials.")
    return {"ok": True}


@app.post("/logout")
async def logout():
    await Auth.logout()
    return {"ok": True}
```

You can also inject an instance with `auth: Auth = Depends(Auth.scoped)`. These methods are coroutines:

| Method | Does |
| --- | --- |
| `await Auth.attempt(credentials, guard=None)` | Checks the credentials and starts a session. Returns `False` on any failure |
| `await Auth.login(user_or_id, guard=None)` | Starts a session for a user or user id, with a new session id |
| `await Auth.logout(guard=None)` | Ends the session |
| `await Auth.validate(credentials, guard=None)` | Returns the user if the credentials are valid, otherwise `None`. Doesn't log in |
| `await Auth.user(guard=None)` / `await Auth.id(...)` / `await Auth.check(...)` | The current user, their id, or whether there is one. Never raises |

## Protecting routes

Depend on `Auth.guard()` to require a user. It returns the user, or answers 401. With no name it uses the default guard, `AuthConfig.default["guard"]`; pass a name to use another one:

```python
from fastapi import Depends
from fastapi_startkit_auth import Auth, optional_user, require_scopes


@app.get("/me")
async def me(user=Depends(Auth.guard())):
    return user


@app.get("/api/me")
async def api_me(user=Depends(Auth.guard("api"))):
    return user


@app.get("/maybe")
async def maybe(user=Depends(optional_user)):  # the user, or None
    return {"user": user}


@app.get("/reports")
async def reports(ctx=Depends(require_scopes("reports:read"))):  # 403 insufficient_scope otherwise
    return {"client": ctx.client_id}
```

`require_scopes("a", "b")` needs every listed scope, and `mode="any"` needs just one. A token with `"*"` passes any scope check. `require_abilities` is the same function under a name that reads better for API-token abilities.

`Auth.guard()` also notifies `on_authenticated` listeners when it resolves a user. The `current_user` dependency returns the same user from the default guard, without notifying them. `auth` gives you the `AuthContext`, with `user`, `scopes`, `client_id`, `jti` and the `can`, `can_any` and `can_all` helpers. It rejects tokens that have no user. `optional_user`, `require_scopes` and `auth` always use the default guard.

## Sessions

```python
SessionConfig(
    driver="memory",          # "memory", "database" or "instance"
    connection=None,          # ORM connection name for driver="database"
    instance=None,            # a ready SessionStore for driver="instance"
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

Sessions back the `session` guard driver and `Auth.login` / `Auth.logout`. Inside a request, the `Session` facade gives access to the current session:

| Method | Does |
| --- | --- |
| `Session.id()` | The session id, or `None` |
| `Session.token()` | The CSRF token, starting a guest session if needed |
| `await Session.regenerate()` | Issues a new session id and keeps the data |
| `await Session.invalidate()` | Destroys the session and clears the cookie |

### CSRF protection

Sessions come with CSRF protection, and it can't be turned off. Any `POST`, `PUT`, `PATCH` or `DELETE` request with a session must send the session's token in the `X-XSRF-TOKEN` header, or in a `_token` field if it's a form post. If the token is missing or wrong, the request gets `403 csrf_token_mismatch`. Requests without a session, like those from bearer-token clients, aren't checked.

The token reaches the browser in the `XSRF-TOKEN` cookie, which JavaScript can read. Login issues a new token and logout deletes the cookie. For a server-rendered form, put `Session.token()` in a hidden `_token` input.

The OAuth `/oauth/token`, `/oauth/introspect` and `/oauth/revoke` endpoints are exempt. To exempt others, such as webhooks, add them to `csrf_exempt_paths`; a trailing `*` matches a prefix.

## API tokens

```python
ApiTokenConfig(
    driver="memory",           # "memory", "database" or "instance"
    connection=None,
    instance=None,
    header="Authorization",    # read as "Bearer {id}|{secret}"
    ttl=None,                  # default lifetime in seconds; None never expires
    purge_interval=300,
    stateful_origins=[],       # non-empty turns on SPA mode
    session_guard="web",
)
```

An API token is an opaque string of the form `{id}|{secret}`. Only a hash of the secret is stored, so the plain token is available once, when it is created. Issue tokens with the `ApiToken` facade:

```python
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi_startkit_auth import ApiToken, Auth, AuthenticationException

app = FastAPI()  # with AuthProvider and AuthApiTokenProvider registered


class Credentials(BaseModel):
    email: str
    password: str


@app.post("/mobile/token")
async def mobile_token(payload: Credentials):
    user = await Auth.validate(payload.model_dump(), guard="api")
    if user is None:
        raise AuthenticationException("Invalid credentials.")
    token = await ApiToken.create(user, name="iPhone", abilities=["posts:read"], guard="api")
    return {"token": token.plain_text}
```

| Method | Does |
| --- | --- |
| `await ApiToken.create(user_or_id, name=None, abilities=None, expires_at=None, guard=None)` | Returns a `NewApiToken`; `.plain_text` is the token |
| `await ApiToken.tokens(user_or_id, guard=None)` | The user's tokens |
| `await ApiToken.revoke(token_id)` | Revokes one token |
| `await ApiToken.revoke_all(user_or_id, guard=None)` | Revokes all of the user's tokens |

A token's abilities become the request's scopes, so `require_abilities` checks them when the default guard is a token guard.

### SPA mode

Setting `stateful_origins` lets a first-party SPA authenticate with the session cookie instead of a token:

```python
AuthApiTokenProvider(ApiTokenConfig(stateful_origins=["https://app.example.com"])).register(app)
```

Token guards then check the `session_guard` session cookie first and fall back to the token header. Before logging in, the SPA calls `GET /__auth__/csrf-cookie` to get a session and a CSRF cookie. Unsafe requests from an `Origin` that isn't in `stateful_origins` are rejected before the CSRF token is even looked at.

## OAuth 2.1 server

```python
from fastapi_startkit_auth import OAuth2Config, OAuthClientConfig, OAuthTokenConfig

OAuth2Config(
    key="change-me-to-a-long-random-secret",
    algorithm="HS256",
    access_token_ttl=3600,
    refresh_token_ttl=60 * 60 * 24 * 14,
    personal_access_token_ttl=60 * 60 * 24 * 365,
    authorization_code_ttl=600,
    issuer="https://auth.example.com",
    resources=["https://api.example.com"],
    scopes={"read": "Read your data"},
    default_scopes=[],
    pkce_methods=["S256"],
    require_pkce=True,
    require_redirect_uri=True,
    grant_types=["authorization_code", "client_credentials", "refresh_token"],
    authorization_guard=None,
    tokens=OAuthTokenConfig(driver="memory"),
    clients=OAuthClientConfig(driver="database"),
)
```

| Setting | Default | Meaning |
| --- | --- | --- |
| `key` | `None` | JWT signing secret. Without it, an ephemeral key is generated with a warning and tokens stop working on restart |
| `issuer` | `None` | Adds an `iss` claim and requires it on decode. Also the `iss` in authorization responses and metadata, which otherwise use the request's base URL |
| `resources` | `[]` | Resources a token may be bound to. A granted resource becomes the token's `aud` |
| `scopes` | `{}` | Scope catalog, name to description. When set, unknown scopes fail with `invalid_scope`. Don't list `"*"`: it grants every ability |
| `default_scopes` | `[]` | Scopes used when a request names none |
| `pkce_methods` | `["S256"]` | Accepted PKCE methods. A missing `code_challenge_method` means `plain` |
| `require_pkce` | `True` | Every authorization request needs a `code_challenge` |
| `require_redirect_uri` | `True` | Authorization requests must send a registered `redirect_uri` |
| `grant_types` | `["authorization_code", "client_credentials", "refresh_token"]` | Enabled grants. Add `"password"` for the legacy password grant |
| `authorization_guard` | `None` | Guard that identifies the user on `/oauth/authorize`. Defaults to the default guard |
| `tokens` | `OAuthTokenConfig(driver="memory")` | Where access tokens, refresh tokens and codes are stored |
| `clients` | `OAuthClientConfig(driver="database")` | Where clients are stored |

`tokens` and `clients` also accept a dict, such as `clients={"driver": "memory"}`.

Earlier versions read `key`, `algorithm`, the four `*_ttl` settings, `tokens`, `issuer`, `resources`, `scopes`, `pkce_methods` and `require_pkce` from `AuthConfig`. Those attributes still work as a fallback, with a `DeprecationWarning`, and a value set on `OAuth2Config` takes precedence. The fallback will be removed in a future release.

### Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 server metadata |
| `GET /oauth/authorize` | Validates an authorization request for your consent screen |
| `POST /oauth/authorize` | Issues a code after consent |
| `POST /oauth/token` | Token endpoint for `authorization_code`, `refresh_token`, `client_credentials`, and `password` when enabled |
| `POST /token` | Simple password-grant endpoint, available only when `"password"` is enabled |
| `POST /oauth/introspect` | RFC 7662 introspection |
| `POST /oauth/revoke` | RFC 7009 revocation |
| `GET /oauth/tokens` | Lists the current user's OAuth tokens |
| `DELETE /oauth/tokens` | Revokes all of them |
| `DELETE /oauth/tokens/{jti}` | Revokes one |
| `POST /oauth/personal-access-tokens` | Creates a personal access token (`name`, `scopes`, `ttl`) |
| `GET /oauth/personal-access-tokens` | Lists the user's active personal access tokens |
| `DELETE /oauth/personal-access-tokens` | Revokes all of them |
| `DELETE /oauth/personal-access-tokens/{jti}` | Revokes one |

Clients authenticate with HTTP Basic (`client_secret_basic`) or form fields (`client_secret_post`), not both in one request. Public clients send only `client_id`. Every token response and error has `Cache-Control: no-store`.

### Clients

A client is either confidential, with a secret, or public (an SPA or native app), with no secret and PKCE required.

A client's `grant_types` and `scopes` limit what it can use. Leave them empty to allow every enabled grant and every scope in the catalog. Asking for a scope outside the client's list fails with `invalid_scope`, even when the scope came from `default_scopes` because the request named none.

Don't give a client `"*"`. A token with `"*"` passes every `require_scopes` check, which is why the command refuses it. If you narrow a client's scopes later, its existing refresh tokens keep their old scopes until their family expires or is revoked.

There are no HTTP routes for managing clients. Under Startkit, create them with the command:

```sh
python artisan auth:oauth2:client --name "My App" --redirect-uri https://app.example.com/callback
python artisan auth:oauth2:client --public --name "My SPA" \
  --redirect-uri https://spa.example.com/callback --redirect-uri http://localhost:5173/callback \
  --scopes "read write"
```

The command prompts for missing values, requires absolute redirect URIs without fragments, and gives the client the `authorization_code` and `refresh_token` grants. `--scopes` (repeatable or space-separated, checked against the catalog) limits the client's scopes. For a confidential client, the secret is printed once.

In code, use the manager's client repository. `register` returns the client and its plain secret, which is `None` for a public client:

```python
manager = app.state.auth_manager  # or container.make("auth_manager") under Startkit

client, secret = await manager.client_repository.register(
    name="reporting",
    redirect_uris=[],
    confidential=True,
    grant_types=["client_credentials"],
    scopes=["reports:read"],  # empty or omitted: any scope
    provider=None,  # an AuthConfig.providers name, for apps with several user providers
)
```

### Authorization code with PKCE

1. Your consent page can validate the request first with `GET /oauth/authorize`, passing `client_id`, `response_type=code`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256` and optionally `resource`. The response has the client name and scopes to show the user.
2. When the user approves, send the same fields as JSON to `POST /oauth/authorize` with `"approved": true`. Without it the request fails with `access_denied`. The user is identified through `authorization_guard`, so a session-backed request also needs the CSRF header. The response contains `code`, `state` and `iss` (RFC 9207), and, when a `redirect_uri` was sent, `redirect_to = <redirect_uri>?code=...&iss=...&state=...`.
3. The client exchanges the code at `POST /oauth/token` with `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier` and `client_id`. A confidential client must also authenticate.

PKCE values follow RFC 7636: an S256 challenge is 43 base64url characters, and a verifier is 43 to 128 unreserved characters. Codes can be used once and expire after `authorization_code_ttl`. A `response_type` other than `code` fails with `unsupported_response_type`.

### Client credentials

Only confidential clients can use `grant_type=client_credentials`. A public client gets `unauthorized_client`, and an unknown or revoked client gets `invalid_client`. The token has no user, so `current_user` and `auth` reject it with 401, while `require_scopes` accepts it.

### Refresh tokens

Refresh tokens are opaque and rotate on every use. All tokens that descend from one grant form a family.

A refresh token is bound to the client it was issued to. Refreshing it requires that client's `client_id`, and its secret if the client is confidential. A request without `client_id` fails with `invalid_client`; one from a different client fails with `invalid_grant`. Only the password grant issues tokens without a client, and those are accepted only while `"password"` is enabled and only without client credentials.

A refresh can narrow the scopes, but can't widen them or change the resource.

If someone uses a refresh token that was already rotated out, the server assumes it was stolen. The request fails with `invalid_grant` and the whole family is revoked, so the attacker and the real client both have to start over. This happens whenever the replayed token reaches the grant, whether it comes from any authenticated client or, for an unbound token, from no client at all.

Some failures leave the family alone. A request that fails client authentication, or sends a client-bound token without `client_id`, gets `invalid_client`. An unused token sent through the wrong client gets `invalid_grant`. In both cases nothing is revoked.

Rotation and code redemption are atomic: when requests race, exactly one wins, across workers too when the database store is used.

### Introspection and revocation

`POST /oauth/introspect` requires a confidential client. For an active access token it returns `active`, `scope`, `client_id`, `sub`, `token_type`, `exp`, `iat` and `jti`, plus `aud` and `iss` when present. Refresh tokens can be introspected too (`token_type: "refresh_token"`). Revoked, expired and unknown tokens return `{"active": false}`, as do tokens whose user was deleted or is inactive.

`POST /oauth/revoke` takes `token`, an optional `token_type_hint`, and client authentication. It revokes the token and its access/refresh chain, but only if the token belongs to the calling client. Unbound tokens can be revoked only while the password grant is enabled. As RFC 7009 requires, the response is `200 {"revoked": true}` even for unknown or foreign tokens.

`GET /oauth/tokens` lists the user's OAuth access tokens, and `DELETE /oauth/tokens` and `DELETE /oauth/tokens/{jti}` revoke them together with their refresh chains. Personal access tokens are managed separately under `/oauth/personal-access-tokens`.

### Resource indicators

Clients can send a `resource` (RFC 8707) to `/oauth/authorize` and `/oauth/token`. It must be listed in `OAuth2Config.resources`, and a request may name only one; otherwise it fails with `invalid_target`.

The code and refresh token keep the resource, and the access token carries it as `aud`. An `OAuth2Guard(audience=...)` accepts only tokens for its audience, and a guard without an audience rejects resource-bound tokens.

### Multiple user providers

A client registered with `provider="admins"` acts for that provider's users. The password grant authenticates against that provider, refresh, code exchange and introspection check the token owner against it, and `POST /oauth/authorize` rejects the client with `unauthorized_client` when the signed-in user belongs to a different provider.

### Legacy password grant

Adding `"password"` to `grant_types` enables `grant_type=password` on `/oauth/token` and the `POST /token` endpoint. While it is disabled, both answer `unsupported_grant_type`.

## Stores and migrations

Sessions, API tokens, OAuth tokens and OAuth clients each have a `driver` setting, and they all take the same values.

`"database"` keeps state in your database through the fastapi-startkit ORM. It needs the `startkit` extra and the migrations below. Set `connection` to use a connection other than the default. `"memory"` keeps state in the process and loses it on restart, which is fine for tests and single-process demos. `"instance"` uses a store object you pass as `instance=`.

`"orm"` still works as an alias of `"database"` but warns that it's deprecated. The old `"sql"` and `"async_sql"` stores are gone, and configuring one raises a `ValueError` that tells you to use `"database"`.

| Config | Default `driver` | Database store and tables |
| --- | --- | --- |
| `SessionConfig` | `"memory"` | `OrmSessionStore`: `sessions` |
| `ApiTokenConfig` | `"memory"` | `OrmApiTokenRepository`: `personal_api_tokens` |
| `OAuthTokenConfig` (`OAuth2Config.tokens`) | `"memory"` | `OrmTokenRepository`: `oauth_access_tokens`, `oauth_refresh_tokens`, `oauth_auth_codes` |
| `OAuthClientConfig` (`OAuth2Config.clients`) | `"database"` | `OrmClientRepository`: `oauth_clients` |

```python
SessionConfig(driver="database")
ApiTokenConfig(driver="database", connection="auth")
OAuth2Config(
    tokens=OAuthTokenConfig(driver="database"),
    clients=OAuthClientConfig(driver="memory"),  # no oauth_clients table
)
```

Each provider publishes only its own migrations, and all of them can be rolled back:

| Provider | Migrations |
| --- | --- |
| `AuthSessionProvider` | `create_sessions_table` |
| `AuthApiTokenProvider` | `create_personal_api_tokens_table` |
| `AuthOAuth2Provider` | `create_oauth_access_tokens_table`, `create_oauth_refresh_tokens_table`, `create_oauth_auth_codes_table`, `add_resource_to_oauth_tables`, `create_oauth_clients_table`, `add_family_id_to_oauth_refresh_tokens_table`, `add_scopes_to_oauth_clients_table` |

```sh
python artisan provider:publish -p auth-oauth2
python artisan db:migrate
python artisan db:migrate:rollback   # reverts the last batch
```

## Errors

Every `AuthException` becomes a JSON body of the form `{"error": ..., "error_description": ...}` with `Cache-Control: no-store`. The `csrf_token_mismatch` response comes from the CSRF middleware and has the same body but no `Cache-Control` header.

| Error | Status |
| --- | --- |
| `invalid_request`, `invalid_grant`, `invalid_scope`, `invalid_target`, `unsupported_grant_type`, `unsupported_response_type`, `unauthorized_client`, `access_denied` | 400 |
| `invalid_client` (with `WWW-Authenticate: Basic`) | 401 |
| `invalid_token`, `invalid_session` (with `WWW-Authenticate: Bearer`) | 401 |
| `insufficient_scope`, `csrf_token_mismatch` | 403 |
| `throttled` | 429 |

A request to a token or OAuth2 guard without a bearer token gets `401 invalid_session` (`AuthenticationException`); an invalid bearer token gets `401 invalid_token`. A wrong username or password on the password grant raises `InvalidCredentialsException`, a subclass of `InvalidGrantException`, and still answers `400 invalid_grant`.
