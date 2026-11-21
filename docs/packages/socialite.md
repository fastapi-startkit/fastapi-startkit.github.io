---
outline: deep
title: Socialite
description: Sign users in with Google through OAuth 2.0 in FastAPI Startkit with an async httpx driver you can extend.
keywords: socialite, oauth, oauth2, google login, social login, fastapi startkit
---

# Socialite

Socialite signs users in with an OAuth 2.0 provider such as Google. It sends the user to the provider's consent screen, checks the `state` value when they come back, exchanges the authorization code for a token and gives you the user's profile.

Google is the built-in driver. You can add other providers with `extend()`.

## Installation

Install the `socialite` extra, which brings in FastAPI, `httpx` and `itsdangerous`:

```bash
uv add "fastapi-startkit[socialite]"
```

Then add `SocialiteProvider` to the providers in `bootstrap/application.py`:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.socialite import SocialiteProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        FastAPIProvider,
        SocialiteProvider,
    ],
)
```

## Configuration

Create an OAuth client in the [Google Cloud console](https://console.cloud.google.com/apis/credentials) and add its credentials to `.env`:

```ini
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://example.com/auth/google/callback
```

They're read into the `services.google` config key:

```python
from fastapi_startkit.configuration import config

config("services.google.client_id")
```

To change the defaults, publish `config/services.py` and pass its config class to the provider:

```bash
uv run python artisan provider:publish --provider=services
```

```python
# bootstrap/application.py
from config.services import ServicesConfig

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        FastAPIProvider,
        (SocialiteProvider, ServicesConfig),
    ],
)
```

If `client_id`, `client_secret` or the redirect URI is missing, `Socialite.driver("google")` raises `DriverMissingConfigurationException`. The message names each missing key and its environment variable.

## Routing

You need two routes: one that sends the user to Google, and one that Google sends them back to. Socialite keeps the `state` value in the session, so add Starlette's `SessionMiddleware` as well:

```python
# app/providers/auth_provider.py
from fastapi import Request
from starlette.middleware.sessions import SessionMiddleware

from fastapi_startkit.environment import env
from fastapi_startkit.facades import Socialite
from fastapi_startkit.fastapi import Router
from fastapi_startkit.support import Provider

from app.models import User


async def redirect(request: Request):
    return Socialite.driver("google").redirect(request)


async def callback(request: Request):
    google_user = await Socialite.driver("google").user(request)

    user = await User.where("google_id", google_user.id).first()
    if user is None:
        user = await User.create(
            {"google_id": google_user.id, "name": google_user.name, "email": google_user.email}
        )

    # Log the user in...


class AuthProvider(Provider):
    def boot(self) -> None:
        self.app.add_middleware(SessionMiddleware, secret_key=env("SESSION_SECRET"))

        router = Router()
        router.get("/auth/google/redirect", redirect)
        router.get("/auth/google/callback", callback)
        self.app.include_router(router.router)
```

`redirect()` returns a `RedirectResponse` to Google's consent screen. For example, with the configuration above the user is sent to:

```text
https://accounts.google.com/o/oauth2/auth?client_id=your-client-id&redirect_uri=https%3A%2F%2Fexample.com%2Fauth%2Fgoogle%2Fcallback&scope=openid+profile+email&response_type=code&state=...
```

`user()` checks the `state`, exchanges the `code` for an access token, and fetches the user's profile. The `state` is removed from the session once it's checked, so each callback URL works only once.

## Handling Errors

Every Socialite error is a `SocialiteException`, so one `except` covers the callback:

| Exception | Raised when |
|---|---|
| `InvalidStateException` | The `state` query parameter is missing or doesn't match the session. This is checked first. |
| `AuthorizationDeniedException` | Google redirected back with `?error=`, for example `access_denied` when the user declined, or without a `code`. `error` and `error_description` hold the details. |
| `ProviderRequestException` | The token or profile request failed. `status_code` holds the HTTP status, or `None` for a network error. |
| `DriverMissingConfigurationException` | `client_id`, `client_secret` or the redirect URI is missing. |

Calling `Socialite.driver()` with a name that isn't registered raises a plain `SocialiteException`.

```python
from fastapi.responses import RedirectResponse

from fastapi_startkit.socialite import AuthorizationDeniedException, SocialiteException


async def callback(request: Request):
    try:
        google_user = await Socialite.driver("google").user(request)
    except AuthorizationDeniedException:
        return RedirectResponse("/login?cancelled=1")
    except SocialiteException:
        return RedirectResponse("/login?failed=1")

    ...
```

## Retrieving User Details

`user()` returns a `SocialiteUser` with these attributes:

| Attribute | Google source |
|---|---|
| `id` | `sub`, as a string |
| `nickname` | `nickname`; Google doesn't send one, so it's `None` |
| `name` | `name` |
| `email` | `email` |
| `avatar` | `picture` |
| `raw` | The full profile payload |
| `token` | The access token |
| `refresh_token` | The refresh token, when Google returns one |
| `expires_in` | The token lifetime in seconds |
| `approved_scopes` | The scopes the user granted, as a list |

### Retrieving a User From a Token

If you already have a valid access token, fetch the user with `user_from_token()`:

```python
user = await Socialite.driver("google").user_from_token(access_token)
```

The returned user has `token` set. `refresh_token` and `expires_in` are `None`, and `approved_scopes` is empty, because no token exchange takes place.

## Scopes and Parameters

Google requests the `openid`, `profile` and `email` scopes by default. `scopes()` adds to them, and `set_scopes()` replaces them:

```python
Socialite.driver("google").scopes("https://www.googleapis.com/auth/calendar.readonly").redirect(request)

Socialite.driver("google").set_scopes("openid", "email").redirect(request)
```

`with_()` adds query parameters to the consent URL. For example, to ask Google for a refresh token:

```python
Socialite.driver("google").with_({"access_type": "offline", "prompt": "consent"}).redirect(request)
```

To send the user back to a different callback URL for one request, call `redirect_url()`:

```python
Socialite.driver("google").redirect_url("https://example.com/auth/google/link").redirect(request)
```

Use the same `redirect_url()` in the matching callback, because Google checks that the token exchange uses the redirect URI from the consent request.

Each call to `Socialite.driver()` returns a new driver, so these settings never carry over to another request.

## Stateless Authentication

An API without a session can skip the `state` check with `stateless()`:

```python
Socialite.driver("google").stateless().redirect()

await Socialite.driver("google").stateless().user(request)
```

A stateless redirect has no `state` parameter, and `redirect()` doesn't need the request. Without `stateless()`, `redirect()` and `user()` raise `SocialiteException` when the request has no session.

## Custom Drivers

To add a provider, subclass `Provider` from `fastapi_startkit.socialite`. Return the provider's URLs, fetch the profile with `request_json()`, and map it to a `SocialiteUser`:

```python
# app/socialite/gitlab.py
from typing import Any

from fastapi_startkit.socialite import Provider, SocialiteUser


class GitLabProvider(Provider):
    default_scopes = ("read_user",)
    scope_separator = " "

    def get_auth_url(self) -> str:
        return "https://gitlab.com/oauth/authorize"

    def get_token_url(self) -> str:
        return "https://gitlab.com/oauth/token"

    async def get_user_by_token(self, token: str) -> dict[str, Any]:
        return await self.request_json(
            "GET", "https://gitlab.com/api/v4/user", headers={"Authorization": f"Bearer {token}"}
        )

    def map_user_to_object(self, user: dict[str, Any]) -> SocialiteUser:
        return SocialiteUser(
            id=str(user["id"]),
            nickname=user["username"],
            name=user["name"],
            email=user.get("email"),
            avatar=user.get("avatar_url"),
            raw=user,
        )
```

`request_json()` sends the request and wraps any failure in `ProviderRequestException`.

Next, add a `gitlab` entry to your published `config/services.py`:

```python
# config/services.py
from dataclasses import dataclass, field

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env
from fastapi_startkit.socialite import GoogleServiceConfig


@dataclass
class GitLabServiceConfig(Config):
    client_id: str | None = env("GITLAB_CLIENT_ID", None, cast=False)
    client_secret: str | None = env("GITLAB_CLIENT_SECRET", None, cast=False)
    redirect: str | None = env("GITLAB_REDIRECT_URI", None, cast=False)


@dataclass
class ServicesConfig(Config):
    google: GoogleServiceConfig = field(default_factory=GoogleServiceConfig)
    gitlab: GitLabServiceConfig = field(default_factory=GitLabServiceConfig)
```

Finally, register the driver with `extend()` in one of your providers' `boot()` method. The factory receives the `services.gitlab` config, and `build_provider()` checks that `client_id`, `client_secret` and `redirect` are set before it creates the driver:

```python
# app/providers/auth_provider.py
from fastapi_startkit.facades import Socialite
from fastapi_startkit.support import Provider

from app.socialite.gitlab import GitLabProvider


class AuthProvider(Provider):
    def boot(self) -> None:
        Socialite.extend(
            "gitlab", lambda config: Socialite.build_provider(GitLabProvider, config, "gitlab")
        )
```

`Socialite.driver("gitlab")` now works like the Google driver.

## Testing

Set the Socialite manager's `transport` to an `httpx.MockTransport` to fake Google's token and profile endpoints:

```python
import httpx

from fastapi_startkit.facades import Socialite


def google(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/oauth2/v4/token":
        return httpx.Response(200, json={"access_token": "token", "expires_in": 3599})
    return httpx.Response(200, json={"sub": "1", "name": "Jane", "email": "jane@example.com"})


app.make("socialite").transport = httpx.MockTransport(google)

user = await Socialite.driver("google").user_from_token("token")

assert user.id == "1"
assert user.email == "jane@example.com"
```

Set the transport before you call `Socialite.driver()`, because each driver takes the transport when it's created.
