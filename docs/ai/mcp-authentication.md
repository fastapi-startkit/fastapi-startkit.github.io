---
outline: deep
title: MCP Authentication
description: Protect a fastapi-startkit MCP server with OAuth2 bearer tokens, protected resource metadata and per-tool scopes using fastapi-startkit-auth.
keywords: MCP, Model Context Protocol, MCP authentication, OAuth2, bearer token, protected resource metadata, RFC 9728, scopes, fastapi-startkit-auth
---

# MCP Authentication

This guide builds an MCP server whose tools require an OAuth2 access token. You end up with:

- an `/mcp` endpoint that answers `401` until the client sends a valid bearer token
- a protected resource metadata document that tells clients where to get a token
- tokens bound to the MCP server, so a token minted for another resource is rejected
- per-tool scopes, so a read-only token can list notes but can't add one

It uses the [MCP](/docs/ai/mcp) server classes and the OAuth 2.1 server from [Authentication](/docs/authentication#oauth-2-1-authoauth2provider). Read those pages for the full APIs. This guide only covers what connects them.

The finished app is [`example/mcp-authentication`](https://github.com/fastapi-startkit/fastapi-startkit-framework/tree/main/example/mcp-authentication). Every file below is copied from it, in the order you create them.

## How it works

1. The client calls `/mcp` without a token. The server answers `401` with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/mcp"`.
2. The client reads that metadata document. It names the resource (`http://127.0.0.1:8000/mcp`), the authorization server and the scopes.
3. The client gets a token from `/oauth/token`, sending `resource=http://127.0.0.1:8000/mcp`. The token carries the resource as its `aud` claim.
4. The client calls `/mcp` with `Authorization: Bearer <token>`. The guard checks the signature, expiry, issuer and audience, and each tool checks its scopes.

## Step 1: Install the packages

Create the project and add the framework with the FastAPI, database and SQLite extras, plus the auth package with its `startkit` extra:

```sh
uv init mcp-authentication
cd mcp-authentication
uv add "fastapi-startkit[fastapi,database,sqlite]" "fastapi-startkit-auth[startkit]>=0.7.0"
uv add --dev pytest pytest-asyncio
rm main.py
```

`uv init` creates a `main.py` you won't use, so the last command deletes it. The dependencies in your `pyproject.toml` now look like this (the versions may differ):

```toml
dependencies = [
    "fastapi-startkit-auth[startkit]>=0.7.0",
    "fastapi-startkit[database,fastapi,sqlite]>=0.63.0",
]
```

## Step 2: Configure the environment

The access tokens are JWTs signed with `OAUTH2_KEY`. `APP_URL` is the public URL of the app. It is both the token issuer and the base of the MCP resource URL.

```ini [.env.example]
APP_ENV=local
APP_URL=http://127.0.0.1:8000
OAUTH2_KEY=change-me-to-a-long-random-secret
DB_CONNECTION=sqlite
DB_DATABASE=databases/sqlite.db
```

Copy it to `.env`:

```sh
cp .env.example .env
```

Set `DB_CONNECTION=sqlite` explicitly. The default connection name is `pgsql`.

Add a testing environment. It's loaded automatically when the app runs under pytest:

```ini [.env.testing]
APP_ENV=testing
APP_URL=http://127.0.0.1:8000
OAUTH2_KEY=testing-key-that-is-long-enough-for-hs256
DB_CONNECTION=sqlite
DB_DATABASE=databases/testing.db
```

Keep `.env` and the SQLite databases out of git:

```gitignore [.gitignore]
.env
*.db
.venv/
__pycache__/
storage/
.pytest_cache/
```

Put the MCP settings in one config class. `resource` is the URL clients send as the `resource` parameter and the value the guard expects in `aud`. `resource_metadata_url` is where the metadata document lives:

```python [config/mcp.py]
from dataclasses import dataclass

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env


@dataclass
class McpConfig(Config):
    app_url: str = env("APP_URL", "http://127.0.0.1:8000")
    path: str = "/mcp"

    @property
    def resource(self) -> str:
        return f"{self.app_url}{self.path}"

    @property
    def resource_metadata_url(self) -> str:
        return f"{self.app_url}/.well-known/oauth-protected-resource{self.path}"
```

## Step 3: Configure the OAuth2 server and the guard

`McpAuthConfig` sets the default guard to an `OAuth2Guard` whose `audience` is the MCP resource. That guard accepts only tokens minted for `http://127.0.0.1:8000/mcp`.

`OAuthConfig` turns on the authorization server. It extends `OAuth2Config` from `fastapi-startkit-auth` and overrides only the defaults this app needs:

- `key` signs the tokens. It comes from `OAUTH2_KEY`.
- `issuer` is written into every token and checked on every request.
- `resources` lists the only values clients may send as `resource`.
- `scopes` is the scope catalog. The metadata document in Step 5 reads it from the auth manager, so the scopes are defined once.
- `grant_types=["client_credentials"]` allows machine clients only.
- Tokens are stored in the database. Clients already are by default.

```python [config/auth.py]
from dataclasses import dataclass, field
from typing import Any

from fastapi_startkit.environment import env
from fastapi_startkit_auth import AuthConfig, OAuth2Config, OAuthTokenConfig
from fastapi_startkit_auth.config import OAuth2Guard

from config.mcp import McpConfig


class McpAuthConfig(AuthConfig):
    default = {"guard": "mcp"}
    providers = {"users": {"driver": "memory"}}

    @classmethod
    def get(cls, name: str, default: Any = None) -> Any:
        if name == "guards":
            return {"mcp": OAuth2Guard(provider="users", audience=McpConfig().resource)}
        return super().get(name, default)


@dataclass
class OAuthConfig(OAuth2Config):
    key: str | None = env("OAUTH2_KEY")
    issuer: str | None = env("APP_URL", "http://127.0.0.1:8000")
    resources: list[str] = field(default_factory=lambda: [McpConfig().resource])
    scopes: dict[str, str] = field(
        default_factory=lambda: {
            "notes:read": "Read your notes",
            "notes:write": "Create notes",
        }
    )
    default_scopes: list[str] = field(default_factory=lambda: ["notes:read"])
    grant_types: list[str] = field(default_factory=lambda: ["client_credentials"])
    tokens: OAuthTokenConfig = field(
        default_factory=lambda: OAuthTokenConfig(driver="database")
    )
```

The provider gets the class itself, not an instance. The application instantiates a provider's config after it loads `.env`, and `env()` reads its variable when the dataclass is instantiated, so `OAuthConfig` and `McpConfig` see the values from your env files.

`McpAuthConfig` is not a dataclass. The auth package reads its settings through the `get()` classmethod when the provider registers, which happens after `.env` loads. So `get()` builds `guards`, and the audience follows your `APP_URL`.

## Step 4: Create the MCP server and its tools

Each tool declares the scopes it needs in a `scopes` attribute. `scopes` isn't part of the `Tool` base class. It's a plain class attribute that Step 5 reads.

```python [app/mcp/tools.py]
from fastapi_startkit.mcp import Response, Tool
from pydantic import BaseModel

notes: list[str] = []


class ListNotesTool(Tool):
    name = "list_notes"
    description = "List every saved note."
    scopes = ["notes:read"]

    async def handle(self, arguments: dict) -> Response:
        return Response.structure({"notes": notes})


class AddNoteInput(BaseModel):
    text: str


class AddNoteTool(Tool):
    name = "add_note"
    description = "Save a new note."
    scopes = ["notes:write"]

    def schema(self) -> type[BaseModel]:
        return AddNoteInput

    async def handle(self, arguments: dict) -> Response:
        note = AddNoteInput(**arguments)
        notes.append(note.text)
        return Response.text(f"Saved note #{len(notes)}.")
```

```python [app/mcp/server.py]
from fastapi_startkit.mcp import Server

from app.mcp.tools import AddNoteTool, ListNotesTool


class NotesServer(Server):
    name = "notes"
    description = "Read and write notes."

    def tools(self):
        return [ListNotesTool, AddNoteTool]
```

See [Defining Tools](/docs/ai/mcp#defining-tools) for schemas and responses.

## Step 5: Protect the MCP endpoint

This file has four parts.

**The metadata document.** `protected_resource_router` serves the [protected resource metadata](https://datatracker.ietf.org/doc/html/rfc9728) at `/.well-known/oauth-protected-resource/mcp` and at the root path. It tells the client which resource it's calling, which authorization server issues tokens for it, and which scopes exist.

**The challenge.** `bearer_challenge` replaces the default auth error response. Every `401` and `403` gets a `WWW-Authenticate` header that points at the metadata document:

- If the request sent no token, the header has only `resource_metadata`.
- If the token was rejected, it adds `error="invalid_token"`.
- If a tool's scope was missing, it adds `error="insufficient_scope"` and the scopes the tool needs.

**The scope check.** `authorize_tool_call` is a dependency on the MCP router. `current_context` authenticates the request through the default guard. A missing token raises `AuthenticationException` and an invalid one `InvalidTokenException`, both 401. For a `tools/call` request, it looks up the tool by name and raises `MissingToolScope` (403) unless the token has every scope the tool declares. A tool without a `scopes` attribute, and every other method, such as `initialize` and `tools/list`, needs only a valid token.

It uses `current_context` instead of `auth` because client credentials tokens have no user, and `auth` rejects user-less tokens.

**The body check.** The dependency reads the JSON-RPC message before the MCP router does. `read_message` raises an `McpServerException` subclass, and `json_rpc_error` turns it into a `400` with a JSON-RPC error. A body that isn't JSON raises `ParseError` (`-32700`). A batch array raises `InvalidRequest` (`-32600`), because the server handles one message per request.

```python [app/mcp/auth.py]
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from fastapi_startkit.mcp import Server, Tool
from fastapi_startkit_auth import AuthException, MissingScopeException
from fastapi_startkit_auth.dependencies import current_context
from fastapi_startkit_auth.guards.guard import AuthContext

from config.mcp import McpConfig


class MissingToolScope(MissingScopeException):
    def __init__(self, tool: type[Tool], scopes: list[str]) -> None:
        self.scopes = scopes
        super().__init__(f"The {tool.name} tool requires: {' '.join(scopes)}.")


class McpServerException(Exception):
    code: int
    message: str

    def to_dict(self) -> dict:
        return {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": self.code, "message": self.message},
        }


class ParseError(McpServerException):
    code = -32700
    message = "Parse error"


class InvalidRequest(McpServerException):
    code = -32600
    message = "Invalid Request"


def protected_resource_router(config: McpConfig, scopes: list[str]) -> APIRouter:
    router = APIRouter()

    @router.get("/.well-known/oauth-protected-resource")
    @router.get(f"/.well-known/oauth-protected-resource{config.path}")
    async def protected_resource_metadata() -> dict:
        return {
            "resource": config.resource,
            "authorization_servers": [config.app_url],
            "scopes_supported": scopes,
            "bearer_methods_supported": ["header"],
        }

    return router


def bearer_challenge(config: McpConfig):
    async def handler(request: Request, error: AuthException) -> JSONResponse:
        params = {"resource_metadata": config.resource_metadata_url}
        if isinstance(error, MissingToolScope):
            params |= {"error": "insufficient_scope", "scope": " ".join(error.scopes)}
        elif request.headers.get("authorization"):
            params |= {"error": "invalid_token"}

        challenge = ", ".join(f'{name}="{value}"' for name, value in params.items())
        return JSONResponse(
            error.to_dict(),
            status_code=error.status_code,
            headers={
                "WWW-Authenticate": f"Bearer {challenge}",
                "Cache-Control": "no-store",
            },
        )

    return handler


async def json_rpc_error(request: Request, error: McpServerException) -> JSONResponse:
    return JSONResponse(error.to_dict(), status_code=400)


async def read_message(request: Request) -> dict:
    try:
        message = await request.json()
    except ValueError:
        raise ParseError from None
    if not isinstance(message, dict):
        raise InvalidRequest
    return message


def called_tool(message: dict, tools: dict[str, type[Tool]]) -> type[Tool] | None:
    if message.get("method") != "tools/call":
        return None
    return tools.get((message.get("params") or {}).get("name"))


def authorize_tool_call(server: Server):
    tools = {tool.name: tool for tool in server.tools() or []}

    async def dependency(
        request: Request, context: AuthContext = Depends(current_context)
    ) -> AuthContext:
        tool = called_tool(await read_message(request), tools)
        scopes = getattr(tool, "scopes", [])
        if tool is not None and not context.can_all(scopes):
            raise MissingToolScope(tool, scopes)
        return context

    return dependency
```

Wire it up in a provider. The MCP router is mounted with the `authorize_tool_call` dependency, so every request to `/mcp` passes through it. `bearer_challenge` is registered for `AuthenticationException`, `InvalidTokenException` and `MissingScopeException`, and `json_rpc_error` for `McpServerException`. The provider also registers the `mcp:client` command. You create that command in Step 6, so the app won't start until then.

```python [providers/mcp_provider.py]
from fastapi import Depends
from fastapi_startkit.support import Provider
from fastapi_startkit_auth import (
    AuthenticationException,
    InvalidTokenException,
    MissingScopeException,
)

from app.commands.create_client import CreateClientCommand
from app.mcp.auth import (
    McpServerException,
    authorize_tool_call,
    bearer_challenge,
    json_rpc_error,
    protected_resource_router,
)
from app.mcp.server import NotesServer
from config.mcp import McpConfig


class McpServiceProvider(Provider):
    def boot(self) -> None:
        config: McpConfig = self.config
        scopes = list(self.app.make("auth_manager").oauth2_config.scopes)
        server = NotesServer()

        self.app.include_router(protected_resource_router(config, scopes))
        self.app.include_router(
            server.router(config.path),
            dependencies=[Depends(authorize_tool_call(server))],
        )

        challenge = bearer_challenge(config)
        for exception in (
            AuthenticationException,
            InvalidTokenException,
            MissingScopeException,
        ):
            self.app.add_exception_handler(exception, challenge)
        self.app.add_exception_handler(McpServerException, json_rpc_error)
        self.commands([CreateClientCommand])
```

Register the providers. `AuthProvider` comes before `AuthOAuth2Provider`, and both get the config functions from Step 3:

```python [bootstrap/application.py]
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.masoniteorm.providers import DatabaseProvider
from fastapi_startkit.mcp import McpProvider
from fastapi_startkit_auth import AuthOAuth2Provider, AuthProvider

from config.auth import McpAuthConfig, OAuthConfig
from config.mcp import McpConfig
from providers.mcp_provider import McpServiceProvider

app: Application = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        DatabaseProvider,
        FastAPIProvider,
        (AuthProvider, McpAuthConfig),
        (AuthOAuth2Provider, OAuthConfig),
        McpProvider,
        (McpServiceProvider, McpConfig),
    ],
)
```

Add the `artisan` entry point:

```python [artisan]
#!/usr/bin/env python3

import sys

from bootstrap.application import app

if __name__ == "__main__":
    sys.exit(app.handle_command())
```

## Step 6: Create a client and issue a token

The `auth:oauth2:client` command creates clients for the authorization code flow. For a machine client, add a command that registers a confidential client with the `client_credentials` grant:

```python [app/commands/create_client.py]
import asyncio

from cleo.helpers import option
from fastapi_startkit.console import Command


class CreateClientCommand(Command):
    name = "mcp:client"
    description = "Create a confidential client that can request MCP access tokens."
    options = [
        option("name", description="Client name.", flag=False, default="MCP client"),
        option(
            "scopes",
            description="Space-separated scopes the client may request.",
            flag=False,
            default="notes:read notes:write",
        ),
    ]

    def handle(self) -> int:
        client, secret = asyncio.run(self.register())
        self.line(f"Client ID: {client.id}")
        self.line(f"Client secret: {secret}")
        return 0

    async def register(self):
        manager = self.container.make("auth_manager")
        return await manager.client_repository.register(
            name=self.option("name"),
            redirect_uris=[],
            confidential=True,
            grant_types=["client_credentials"],
            scopes=self.option("scopes").split(),
        )
```

Every file is in place now. Publish the OAuth2 migrations into `databases/migrations` and run them:

```sh
uv run python artisan provider:publish -p auth-oauth2
uv run python artisan db:migrate
```

See [Migrations](/docs/authentication#migrations) for the tables they create.

Create a client and start the server:

```sh
uv run python artisan mcp:client
uv run python artisan serve
```

```
Client ID: <client-id>
Client secret: <client-secret>
```

Call `/mcp` without a token. You get the challenge:

```sh
curl -i -X POST http://127.0.0.1:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

```
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer resource_metadata="http://127.0.0.1:8000/.well-known/oauth-protected-resource/mcp"
cache-control: no-store

{"error":"invalid_session","error_description":"Not authenticated."}
```

Follow the link:

```sh
curl http://127.0.0.1:8000/.well-known/oauth-protected-resource/mcp
```

```json
{
  "resource": "http://127.0.0.1:8000/mcp",
  "authorization_servers": ["http://127.0.0.1:8000"],
  "scopes_supported": ["notes:read", "notes:write"],
  "bearer_methods_supported": ["header"]
}
```

Exchange the client credentials for a token. Send the MCP resource URL as `resource`. Without it, the token has no audience and the `mcp` guard rejects it.

```sh
curl -X POST http://127.0.0.1:8000/oauth/token \
  -d grant_type=client_credentials \
  -d client_id=<client-id> \
  -d client_secret=<client-secret> \
  -d resource=http://127.0.0.1:8000/mcp \
  -d scope="notes:read notes:write"
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "notes:read notes:write"
}
```

Call a tool with the token:

```sh
curl -X POST http://127.0.0.1:8000/mcp \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_note","arguments":{"text":"Buy milk"}}}'
```

A token requested with only `scope=notes:read` can list notes, but `add_note` returns `403`:

```
HTTP/1.1 403 Forbidden
www-authenticate: Bearer resource_metadata="http://127.0.0.1:8000/.well-known/oauth-protected-resource/mcp", error="insufficient_scope", scope="notes:write"
```

See [Client credentials](/docs/authentication#client-credentials) and [Resource indicators](/docs/authentication#resource-indicators) for the rules `/oauth/token` applies.

## Step 7: Connect a client

Any MCP client that speaks Streamable HTTP and lets you set the `Authorization` header can connect. Give it:

- the URL `http://127.0.0.1:8000/mcp`
- the header `Authorization: Bearer <access-token>`, using the token from Step 6

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is a quick way to try it:

```sh
npx @modelcontextprotocol/inspector
```

The server doesn't offer dynamic client registration, so a client can't register itself. Create the client with `mcp:client`, get a token, and paste the token into the client. When the token expires (after `expires_in` seconds), request a new one.

## Step 8: Test it

Configure pytest to run async tests and to import from the project root:

```ini [pytest.ini]
[pytest]
asyncio_mode = auto
pythonpath = .
```

The tests use `HttpTestCase` to send requests to the app in memory.

- [`RefreshDatabase`](/docs/testing/database#refreshdatabase) migrates the testing database once per session and rolls each test back, so clients and tokens don't leak between tests.
- `issue_token` registers a client and calls `/oauth/token` the same way a real client does.
- `sign_token` signs a JWT with the real key, issuer and audience, and lets a test override one claim. The expired token and the token for another resource each have exactly one thing wrong with them.

```python [tests/test_mcp_authentication.py]
import time

import jwt
from fastapi_startkit.fastapi.testing import HttpTestCase
from fastapi_startkit.masoniteorm.testing import RefreshDatabase

from config.auth import OAuthConfig
from config.mcp import McpConfig


class TestMcpAuthentication(HttpTestCase, RefreshDatabase):
    def get_application(self):
        from bootstrap.application import app

        return app

    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.config = McpConfig()

    async def issue_token(self, scopes: str, resource: str | None = None) -> str:
        manager = self.get_application().make("auth_manager")
        client, secret = await manager.client_repository.register(
            name="tests",
            redirect_uris=[],
            confidential=True,
            grant_types=["client_credentials"],
            scopes=scopes.split(),
        )
        data = {"grant_type": "client_credentials", "scope": scopes}
        if resource is not None:
            data["resource"] = resource
        response = await self.client.post(
            "/oauth/token", data=data, auth=(client.id, secret)
        )
        assert response.status_code == 200, response.text
        return response.json()["access_token"]

    def sign_token(self, **claims) -> str:
        now = int(time.time())
        payload = {
            "sub": None,
            "aud": self.config.resource,
            "iss": self.config.app_url,
            "iat": now,
            "exp": now + 60,
        }
        return jwt.encode(payload | claims, OAuthConfig().key, algorithm="HS256")

    async def rpc(
        self, method: str, params: dict | None = None, token: str | None = None
    ):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        return await self.client.post(
            "/mcp",
            json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
            headers=headers,
        )

    async def test_request_without_token_is_challenged(self):
        response = await self.rpc("tools/list")

        assert response.status_code == 401
        assert response.headers["www-authenticate"] == (
            f'Bearer resource_metadata="{self.config.resource_metadata_url}"'
        )

    async def test_protected_resource_metadata_names_the_authorization_server(self):
        for path in (
            "/.well-known/oauth-protected-resource",
            "/.well-known/oauth-protected-resource/mcp",
        ):
            response = await self.client.get(path)

            assert response.status_code == 200
            assert response.json() == {
                "resource": self.config.resource,
                "authorization_servers": [self.config.app_url],
                "scopes_supported": ["notes:read", "notes:write"],
                "bearer_methods_supported": ["header"],
            }

    async def test_valid_token_can_list_and_call_tools(self):
        token = await self.issue_token("notes:read notes:write", self.config.resource)

        initialized = await self.rpc("initialize", token=token)
        listed = await self.rpc("tools/list", token=token)
        added = await self.rpc(
            "tools/call", {"name": "add_note", "arguments": {"text": "Buy milk"}}, token
        )
        read = await self.rpc(
            "tools/call", {"name": "list_notes", "arguments": {}}, token
        )

        assert initialized.json()["result"]["serverInfo"]["name"] == "notes"
        assert [tool["name"] for tool in listed.json()["result"]["tools"]] == [
            "list_notes",
            "add_note",
        ]
        assert added.json()["result"]["content"][0]["text"].startswith("Saved note #")
        assert "Buy milk" in read.json()["result"]["content"][0]["resource"]["text"]

    async def test_token_without_the_tool_scope_is_forbidden(self):
        token = await self.issue_token("notes:read", self.config.resource)

        response = await self.rpc(
            "tools/call", {"name": "add_note", "arguments": {"text": "Nope"}}, token
        )

        assert response.status_code == 403
        assert response.json()["error"] == "insufficient_scope"
        assert response.headers["www-authenticate"] == (
            f'Bearer resource_metadata="{self.config.resource_metadata_url}", '
            'error="insufficient_scope", scope="notes:write"'
        )

    async def test_malformed_token_is_rejected(self):
        response = await self.rpc("tools/list", token="not-a-token")

        assert response.status_code == 401
        assert 'error="invalid_token"' in response.headers["www-authenticate"]

    async def test_expired_token_is_rejected(self):
        now = int(time.time())
        token = self.sign_token(iat=now - 120, exp=now - 60)

        response = await self.rpc("tools/list", token=token)

        assert response.status_code == 401
        assert response.json()["error_description"] == "Signature has expired"

    async def test_token_without_resource_is_rejected(self):
        token = await self.issue_token("notes:read")

        response = await self.rpc("tools/list", token=token)

        assert response.status_code == 401
        assert 'error="invalid_token"' in response.headers["www-authenticate"]

    async def test_token_for_another_resource_is_rejected(self):
        token = self.sign_token(aud=f"{self.config.app_url}/reports")

        response = await self.rpc("tools/list", token=token)

        assert response.status_code == 401
        assert response.json()["error_description"] == "Audience doesn't match"

    async def test_body_that_is_not_json_is_a_parse_error(self):
        token = await self.issue_token("notes:read", self.config.resource)

        response = await self.client.post(
            "/mcp",
            content="{not json",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )

        assert response.status_code == 400
        assert response.json() == {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32700, "message": "Parse error"},
        }

    async def test_batch_request_is_an_invalid_request(self):
        token = await self.issue_token("notes:read", self.config.resource)

        response = await self.client.post(
            "/mcp",
            json=[{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}],
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 400
        assert response.json() == {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32600, "message": "Invalid Request"},
        }
```

Run them:

```sh
uv run pytest tests/ -v
```

## Limits

The example builds these pieces itself because the framework doesn't provide them yet:

- `Server.router()` has no authentication option, so the dependency is passed to `include_router`.
- `Tool.handle()` doesn't receive the request or the token, so a tool can't tell who is calling it.
- There's no built-in protected resource metadata endpoint or `resource_metadata` challenge.
- There's no dynamic client registration.
- The MCP server reports protocol version `2024-11-05`, but `resource_metadata` discovery comes from the `2025-06-18` spec, so older clients may look for the authorization server another way.
