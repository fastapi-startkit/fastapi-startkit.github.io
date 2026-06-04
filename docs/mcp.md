---
outline: deep
title: MCP (Model Context Protocol)
description: Build MCP servers with tools, prompts, and resources using fastapi-startkit — a class-based MCP framework for FastAPI Startkit.
keywords: MCP, Model Context Protocol, JSON-RPC, AI tools, FastAPI, fastapi-startkit
---

# MCP (Model Context Protocol)

The [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) is a JSON-RPC 2.0 standard that lets AI assistants — such as Claude, Cursor, and other MCP-compatible clients — discover and call capabilities exposed by your application. `fastapi-startkit` includes built-in support for MCP: define servers, tools, prompts, and resources as plain Python classes and mount them on your app with a single line.

## Creating a Server

A server is the top-level object that groups your tools, prompts, and resources. Subclass `Server`, set the `name` (required), and override `tools()`, `prompts()`, and `resources()` to return lists of the classes you want to register.

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

Return `None` (the default) from any of the three list methods to omit that capability entirely.

## Mounting the Router on FastAPI

Call `server.router(prefix)` to get a FastAPI `APIRouter` and include it in your app:

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

Pass `prefix=""` to mount at the application root.

## Defining Tools

Tools are callable actions that an AI client can invoke. Subclass `Tool`, set `name` and `description`, define the input shape with a Pydantic model returned from `schema()`, and implement `handle()`.

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

Provide an output schema by overriding `output_schema()`. When set, its JSON schema is included in `tools/list` under `outputSchema`:

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

Prompts are parameterised message templates that AI clients can retrieve. Subclass `Prompt`, declare your arguments via `arguments()`, and generate the content in `handle()`.

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

Override `should_register()` to skip a prompt at boot time — useful for feature-flagging prompts at startup:

```python
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

Resources expose readable data (files, database records, API responses) that AI clients can fetch by URI. Subclass `Resource`, set `uri` and `name`, and implement `read()`.

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

`mime_type` defaults to `"text/plain"`. Set it to `"application/json"` or another MIME type as appropriate for the resource content.

## Response

`Response` wraps the content returned from tools and prompts into MCP's content format. Two factory methods are available:

| Method | Use case |
|---|---|
| `Response.text(value: str)` | Plain text output |
| `Response.structure(data: dict)` | Structured (resource-type) content |

```python
# Text response
return Response.text("Operation completed successfully.")

# Structured response
return Response.structure({"status": "ok", "count": 42})
```

## JSON-RPC methods

The router handles the full set of standard MCP methods automatically:

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

The following self-contained example puts all the pieces together — a calculator server that adds numbers, a greeting prompt, and a resource that exposes a status string.

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

Once running, point any MCP-compatible client at `POST /mcp` and call `initialize` to start a session:

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
