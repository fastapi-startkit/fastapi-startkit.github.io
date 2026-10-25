---
outline: deep
title: MCP (Model Context Protocol)
description: Build class-based MCP servers with tools, prompts, and resources in FastAPI Startkit.
keywords: MCP, Model Context Protocol, JSON-RPC, AI tools, FastAPI, fastapi-startkit
---

# MCP (Model Context Protocol)

The [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) is a JSON-RPC 2.0 standard that lets AI clients such as Claude and Cursor discover and call features of your application. If you'd like an assistant to look up records, run calculations, or read project files through your app, MCP is how you expose that.

FastAPI Startkit keeps this pleasantly simple. You define servers, tools, prompts, and resources as Python classes, then mount the server as a router. The framework takes care of the JSON-RPC plumbing for you.

## Getting Started

First, register `McpProvider` alongside `FastAPIProvider` in your application:

```python
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.mcp import McpProvider

app = Application(providers=[FastAPIProvider, McpProvider])
```

Then define your tools, prompts, and resources as classes, and mount the server's router on the app:

```python
from fastapi_startkit.mcp import Server

class MyServer(Server):
    name = "my-server"
    def tools(self): return [MyTool]

server = MyServer()
app.include_router(server.router(prefix="/mcp"))
```

## Creating a Server

A server is what groups your tools, prompts, and resources together. To create one, subclass `Server`, set the required `name`, and override `tools()`, `prompts()`, and `resources()` to return the classes you want to register.

```python
from fastapi_startkit.mcp import Server, Tool, Prompt, Resource

class MyServer(Server):
    name = "my-server"
    description = "My MCP server"
    instructions = "Call tools/list to see available tools."

    def tools(self):
        return [AddTool]

    def prompts(self):
        return [GreetPrompt]

    def resources(self):
        return [ReadmeResource]
```

| Attribute | Type | Purpose |
|---|---|---|
| `name` | `str` | Server identifier reported during `initialize` |
| `description` | `str \| None` | Human-readable description |
| `instructions` | `str \| None` | Usage hints surfaced to AI clients |

If you return `None` (the default) from any of the three methods, nothing is registered for it. The server still advertises all three capabilities in `initialize` and returns an empty list.

## Mounting the Router on FastAPI

Calling `server.router(prefix)` gives you a FastAPI `APIRouter`, which you include in your app like any other router:

```python
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.mcp import Server

server = MyServer()

app = Application(providers=[FastAPIProvider])
app.include_router(server.router(prefix="/mcp"))
```

The router exposes two endpoints:

| Method | Path | Behaviour |
|---|---|---|
| `POST` | `/mcp` | JSON-RPC 2.0 endpoint — all MCP operations |
| `GET` | `/mcp` | Returns `405 Method Not Allowed` with `Allow: POST` |

If you'd rather mount the server at the application root, pass `prefix=""`.

## Defining Tools

A tool is an action the AI client can call. To define one, subclass `Tool` and set its `name` and `description`. Then return a Pydantic model describing the input from `schema()`, and implement `handle()`.

```python
from pydantic import BaseModel
from fastapi_startkit.mcp import Tool, Response

class AddInput(BaseModel):
    a: int
    b: int

class AddTool(Tool):
    name = "add"
    description = "Add two integers and return the result."

    def schema(self) -> type[BaseModel]:
        return AddInput

    async def handle(self, arguments: dict) -> Response:
        result = arguments.get("a", 0) + arguments.get("b", 0)
        return Response.text(str(result))
```

### Optional output schema

If you want to tell clients what a tool returns, override `output_schema()` to describe the result. Its JSON schema appears in `tools/list` under `outputSchema`:

```python
class SumOutput(BaseModel):
    total: int

class AddTool(Tool):
    name = "add"
    description = "Add two integers."

    def schema(self):
        return AddInput

    def output_schema(self):
        return SumOutput

    async def handle(self, arguments: dict) -> Response:
        total = arguments.get("a", 0) + arguments.get("b", 0)
        return Response.structure({"total": total})
```

## Defining Prompts

A prompt is a message template with arguments that AI clients can fetch. To define one, subclass `Prompt`, declare its arguments in `arguments()`, and build the message in `handle()`.

```python
from fastapi_startkit.mcp import Prompt, Argument, Response

class GreetPrompt(Prompt):
    name = "greet"
    title = "Greeting"
    description = "Generates a personalised greeting."

    def arguments(self) -> list[Argument]:
        return [
            Argument(name="name", description="The person to greet", required=True),
        ]

    async def handle(self, arguments: dict) -> Response:
        name = arguments.get("name", "there")
        return Response.text(f"Hello, {name}! How can I help you today?")
```

### Conditional registration

Sometimes a prompt should only be available in certain situations, for example behind a feature flag. Override `should_register()` to hide it. The method is checked on every `prompts/list` and `prompts/get` request:

```python
import os

class BetaPrompt(Prompt):
    name = "beta-feature"
    description = "Only available when beta flag is on."

    def should_register(self) -> bool:
        return os.getenv("BETA_FEATURES") == "true"

    async def handle(self, arguments: dict) -> Response:
        return Response.text("Beta feature output.")
```

### `Argument` fields

| Field | Type | Default | Purpose |
|---|---|---|---|
| `name` | `str` | required | Argument identifier |
| `description` | `str \| None` | `None` | Human-readable hint |
| `required` | `bool` | `False` | Whether the argument must be supplied |

## Defining Resources

A resource is read-only data, such as a file or a database record, that AI clients fetch by URI. To define one, subclass `Resource`, set `uri` and `name`, and implement `read()`.

```python
from fastapi_startkit.mcp import Resource

class ReadmeResource(Resource):
    uri = "file://README.md"
    name = "readme"
    description = "The project README file."
    mime_type = "text/plain"  # default — override as needed

    async def read(self, **kwargs) -> str:
        with open("README.md") as f:
            return f.read()
```

The `mime_type` defaults to `"text/plain"`. When the content isn't plain text, set it to `"application/json"` or another suitable type.

## Response

The `Response` class converts what your tools and prompts return into MCP's content format. It offers three factory methods:

| Method | Use case |
|---|---|
| `Response.text(value: str)` | Plain text output |
| `Response.structure(data: dict)` | Structured (resource-type) content |
| `Response.empty()` | No content |

```python
# Text response
return Response.text("Operation completed successfully.")

# Structured response
return Response.structure({"status": "ok", "count": 42})
```

## JSON-RPC methods

Out of the box, the router handles the following MCP methods:

| Method | Description |
|---|---|
| `initialize` | Handshake — returns protocol version and capabilities |
| `tools/list` | List all registered tools |
| `tools/call` | Invoke a tool by name |
| `prompts/list` | List all registered prompts |
| `prompts/get` | Retrieve a rendered prompt by name |
| `resources/list` | List all registered resources |
| `resources/read` | Read a resource by URI |

Notifications (requests without an `id`) return HTTP `202` with an empty body.

## Complete example

To see everything working together, here's a calculator server with an `add` tool, a greeting prompt, and a status resource.

```python
from pydantic import BaseModel

from fastapi_startkit.mcp import (
    Argument,
    Prompt,
    Resource,
    Response,
    Server,
    Tool,
)


# ── Tool ──────────────────────────────────────────────────────────────────────

class AddInput(BaseModel):
    a: int
    b: int


class AddTool(Tool):
    name = "add"
    description = "Add two integers."

    def schema(self):
        return AddInput

    async def handle(self, arguments: dict) -> Response:
        total = arguments.get("a", 0) + arguments.get("b", 0)
        return Response.text(str(total))


# ── Prompt ────────────────────────────────────────────────────────────────────

class GreetPrompt(Prompt):
    name = "greet"
    title = "Greeting"
    description = "Generates a personalised greeting."

    def arguments(self):
        return [Argument(name="name", description="Who to greet", required=True)]

    async def handle(self, arguments: dict) -> Response:
        name = arguments.get("name", "there")
        return Response.text(f"Hello, {name}!")


# ── Resource ──────────────────────────────────────────────────────────────────

class StatusResource(Resource):
    uri = "resource:///status"
    name = "status"
    description = "Application status."

    async def read(self, **kwargs) -> str:
        return "ok"


# ── Server ────────────────────────────────────────────────────────────────────

class CalculatorServer(Server):
    name = "calculator"
    description = "A simple calculator MCP server."
    instructions = "Use the `add` tool to sum integers."

    def tools(self):
        return [AddTool]

    def prompts(self):
        return [GreetPrompt]

    def resources(self):
        return [StatusResource]


# ── Application ───────────────────────────────────────────────────────────────

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

server = CalculatorServer()

app = Application(providers=[FastAPIProvider])
app.include_router(server.router(prefix="/mcp"))
```

Now point an MCP client at `POST /mcp` and send `initialize` to start a session:

```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "id": 1,
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "my-client", "version": "1.0" }
  }
}
```
