---
outline: deep
title: MCP (Model Context Protocol)
description: Build class-based MCP servers with tools, prompts, and resources in FastAPI Startkit.
keywords: MCP, Model Context Protocol, JSON-RPC, AI tools, FastAPI, fastapi-startkit
---

# MCP (Model Context Protocol)

The [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) is a JSON-RPC 2.0 standard that lets AI clients such as Claude and Cursor discover and call features of your application. Use it when you want an assistant to look up records, run actions, or read data through your app.

You define a server and its tools, prompts, and resources as Python classes, then mount the server on your application as a router.

## Getting Started

Register `McpProvider` next to `FastAPIProvider`:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.mcp import McpProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[FastAPIProvider, McpProvider],
)
```

Then create a server, list its tools, and mount it.

## Creating a Server

A server groups your tools, prompts, and resources. Subclass `Server`, set its `name`, and override `tools()`, `prompts()`, and `resources()` to return the classes you want to expose:

```python
# app/mcp/blog_server.py
from fastapi_startkit.mcp import Server


class BlogServer(Server):
    name = "blog"
    description = "Read and manage blog posts."
    instructions = "Call tools/list to see what you can do."

    def tools(self):
        return [AddTool, DeletePostTool]

    def prompts(self):
        return [GreetPrompt]

    def resources(self):
        return [StatusResource]
```

| Attribute | Type | Purpose |
|---|---|---|
| `name` | `str` | Server name reported by `initialize`. Required. |
| `description` | `str \| None` | Description reported by `initialize`. |
| `instructions` | `str \| None` | Usage hints reported to AI clients by `initialize`. |
| `exception_handler` | `type[McpExceptionHandler]` | Turns exceptions into JSON-RPC errors. See [Rendering Exceptions](#rendering-exceptions). |

Each of the three methods returns `None` by default, which lists nothing. The server still advertises tools, prompts, and resources in `initialize`, and the matching list call returns an empty list.

## Mounting the Router on FastAPI

`server.router(prefix)` returns a FastAPI `APIRouter`. Include it in your application like any other router:

```python
# bootstrap/application.py
from app.mcp.blog_server import BlogServer

app.include_router(BlogServer().router(prefix="/mcp"))
```

The prefix defaults to `/mcp`. Pass `prefix=""` to mount the server at the application root.

| Method | Path | Behaviour |
|---|---|---|
| `POST` | `/mcp` | The JSON-RPC 2.0 endpoint for every MCP request. |
| `GET`, `HEAD`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` | `/mcp` | `405 Method Not Allowed` with an `Allow: POST` header. |

## Defining Tools

A tool is an action the AI client can call. Subclass `Tool`, set `name` and `description`, return a Pydantic model that describes the input from `schema()`, and implement `handle()`:

```python
# app/mcp/tools/add_tool.py
from pydantic import BaseModel

from fastapi_startkit.mcp import Response, Tool


class AddInput(BaseModel):
    a: int
    b: int


class AddTool(Tool):
    name = "add"
    description = "Add two integers and return the result."

    def schema(self):
        return AddInput

    async def handle(self, arguments: dict) -> Response:
        return Response.text(str(arguments["a"] + arguments["b"]))
```

The model's JSON schema is listed in `tools/list` as the tool's `inputSchema`. A tool without a schema lists an empty object schema.

When `schema()` returns a plain Pydantic model, `handle()` receives the raw `arguments` dict and the model only describes the input to the client. To validate input, use a [form request](#validating-input-with-a-formrequest).

### Describing the Output {#optional-output-schema}

Override `output_schema()` to tell clients what a tool returns. Its JSON schema is listed in `tools/list` as `outputSchema`:

```python
# app/mcp/tools/add_tool.py
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
        return Response.structure({"total": arguments["a"] + arguments["b"]})
```

### Authorizing a Tool {#authorizing-a-tool}

Override `authorize()` to refuse a call before any input is validated. It can be a regular or an `async` method, and its return value decides the call:

| Result | Effect |
|---|---|
| `True` or `None` | The call continues. `None` is the default, so a tool that refuses by raising doesn't need `return True`. |
| `False` | The call fails with the error `-32000` and the message `This action is unauthorized.` |
| An exception | The exception is rendered like any other. See [Rendering Exceptions](#rendering-exceptions). |

```python
# app/mcp/tools/delete_post_tool.py
import os

from fastapi_startkit.mcp import Response, Tool


class DeletePostTool(Tool):
    name = "posts_delete"
    description = "Delete a post."

    def authorize(self) -> bool:
        return os.getenv("ALLOW_POST_DELETES") == "true"

    async def handle(self, arguments: dict) -> Response:
        return Response.text("Deleted.")
```

### Validating Input With a Form Request {#validating-input-with-a-formrequest}

When `schema()` returns a [`FormRequest`](/docs/validation), every `tools/call` runs in this order:

1. The tool's `authorize()`.
2. The form request's own `authorize`, `prepare_for_validation`, rules, and `after`.
3. `handle()`, which receives the validated form request instance.

```python
# app/mcp/tools/signup_tool.py
from typing import Annotated

from fastapi_startkit.mcp import Response, Tool
from fastapi_startkit.validation import Field, FormRequest


class SignupInput(FormRequest):
    username: Annotated[str, Field().required().string().min(3)]
    age: Annotated[int, Field().required().integer().between(18, 120)]


class SignupTool(Tool):
    name = "signup"
    description = "Sign a user up."

    def schema(self):
        return SignupInput

    async def handle(self, request: SignupInput) -> Response:
        return Response.text(f"Welcome, {request.username}.")
```

Because `handle()` gets the typed instance, enum fields hold enum members, date fields hold `date` objects, and any methods you define on the form request are available. To tell a field the caller left out from one it sent, check `request.model_fields_set`.

Don't catch the `ValidationException` in `handle()`. The server answers with every field message for you:

```json
{"jsonrpc": "2.0", "id": 1, "error": {
  "code": -32000,
  "message": "The username field must be at least 3 characters. (and 1 more error)",
  "data": {"username": ["The username field must be at least 3 characters."], "age": ["The age field must be between 18 and 120."]}
}}
```

A field typed as a nested Pydantic model is validated too, and its errors use dotted keys such as `address.city`.

## Rendering Exceptions

An exception raised while handling a request becomes a JSON-RPC error. Without a renderer, the error is `{"code": -32000, "message": str(exc)}`.

To choose the code and message yourself, subclass `McpExceptionHandler`, register renderers, and set the class as the server's `exception_handler`. A renderer returns a `JsonRpcError(code, message, data=None)`, and `data` is sent only when it's set:

```python
# app/mcp/exceptions.py
from fastapi_startkit.mcp import JsonRpcError, McpExceptionHandler, Server


class NotFoundRenderer:
    async def render(self, request, exc: LookupError) -> JsonRpcError:
        return JsonRpcError(-32004, f"{exc} was not found.")


class AppMcpExceptions(McpExceptionHandler):
    def register(self) -> None:
        super().register()
        self.register_handler(LookupError, NotFoundRenderer())
        self.register_render(TimeoutError, lambda request, exc: JsonRpcError(-32001, "Try again later."))


class BlogServer(Server):
    name = "blog"
    exception_handler = AppMcpExceptions
```

Matching works as in the [HTTP exception handler](/docs/exception-handling):

- `register_handler` matches the exception class and its subclasses. The handler's `render` method must be `async`.
- `register_render` matches the exact class only. The callable can be a regular or an `async` function.

Call `super().register()` to keep the built-in renderer for `ValidationException`. Rendered exceptions aren't reported, so log anything you need inside the renderer.

## Defining Prompts

A prompt is a message template that AI clients fetch with arguments. Subclass `Prompt`, declare its arguments in `arguments()`, and build the message in `handle()`:

```python
# app/mcp/prompts/greet_prompt.py
from fastapi_startkit.mcp import Argument, Prompt, Response


class GreetPrompt(Prompt):
    name = "greet"
    title = "Greeting"
    description = "Generates a personalised greeting."

    def arguments(self) -> list[Argument]:
        return [
            Argument(name="name", description="The person to greet", required=True),
        ]

    async def handle(self, arguments: dict) -> Response:
        return Response.text(f"Hello, {arguments.get('name', 'there')}!")
```

`prompts/get` returns each content item of the response as a `user` message.

### Hiding a Prompt {#conditional-registration}

Override `should_register()` to hide a prompt, for example behind a feature flag. It's checked on every `prompts/list` and `prompts/get` request:

```python
# app/mcp/prompts/beta_prompt.py
import os

from fastapi_startkit.mcp import Prompt, Response


class BetaPrompt(Prompt):
    name = "beta-feature"
    description = "Only available when the beta flag is on."

    def should_register(self) -> bool:
        return os.getenv("BETA_FEATURES") == "true"

    async def handle(self, arguments: dict) -> Response:
        return Response.text("Beta feature output.")
```

### Argument Fields {#argument-fields}

| Field | Type | Default | Purpose |
|---|---|---|---|
| `name` | `str` | required | The argument's name. |
| `description` | `str \| None` | `None` | A hint for the client. |
| `required` | `bool` | `False` | Whether the client must send the argument. |

## Defining Resources

A resource is read-only data, such as a file or a record, that AI clients fetch by URI. Subclass `Resource`, set `uri` and `name`, and return the content as a string from `read()`:

```python
# app/mcp/resources/status_resource.py
import json

from fastapi_startkit.mcp import Resource


class StatusResource(Resource):
    uri = "resource:///status"
    name = "status"
    description = "Application status."
    mime_type = "application/json"

    async def read(self, **kwargs) -> str:
        return json.dumps({"status": "ok"})
```

`mime_type` defaults to `text/plain`.

## Building Responses {#response}

Tools and prompts return a `Response`. Create one with a factory method:

| Method | Content |
|---|---|
| `Response.text(value)` | A text item. |
| `Response.structure(data)` | A resource item holding `data` as JSON, with the `application/json` MIME type. |
| `Response.empty()` | No content. |

```python
return Response.text("Post published.")

return Response.structure({"status": "ok", "count": 42})
```

## Supported Methods {#json-rpc-methods}

The server handles these MCP methods:

| Method | Description |
|---|---|
| `initialize` | Returns the protocol version (`2024-11-05`), server info, and capabilities. |
| `tools/list` | Lists the server's tools. |
| `tools/call` | Calls a tool by `name` with `arguments`. |
| `prompts/list` | Lists the server's visible prompts. |
| `prompts/get` | Renders a prompt by `name` with `arguments`. |
| `resources/list` | Lists the server's resources. |
| `resources/read` | Reads a resource by `uri`. |

Any other method answers with the error `-32601`. A request's `id` can be a string or an integer, and the response echoes it back.

When `tools/call`, `prompts/get`, or `resources/read` names something the server doesn't have, the response is a successful result that holds the error:

```json
{"jsonrpc": "2.0", "id": 1, "result": {"error": {"code": -32602, "message": "Tool not found: missing"}}}
```

## Handling Malformed Requests

The server checks each request body before it dispatches it. A body that isn't a valid request is rejected with HTTP `400` and an `id` of `null`:

| Problem | Error code | Example message |
|---|---|---|
| The body isn't valid JSON. | `-32700` | `Parse error: the body is not valid JSON.` |
| The `method` field is missing. | `-32600` | `The method field is required.` |
| A request has no `id`. | `-32600` | `The id field is required for tools/list.` |

For `-32600` errors, `data` holds the field messages:

```json
{"jsonrpc": "2.0", "id": null, "error": {
  "code": -32600,
  "message": "The id field is required for tools/list.",
  "data": {"id": ["The id field is required for tools/list."]}
}}
```

A notification is a request without an `id` whose method starts with `notifications/`, such as `notifications/initialized`. The server accepts it with HTTP `202` and an empty body.

The request model is `MCPRequest`, exported from `fastapi_startkit.mcp`. The old name `JsonRpcRequest` still imports, with a deprecation warning. Import `MCPRequest` instead.

## Complete Example

Here's a blog server with a tool, a prompt, and a resource, mounted on an application:

```python
# app.py
import json
from pathlib import Path

from pydantic import BaseModel

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.mcp import (
    Argument,
    McpProvider,
    Prompt,
    Resource,
    Response,
    Server,
    Tool,
)


class AddInput(BaseModel):
    a: int
    b: int


class AddTool(Tool):
    name = "add"
    description = "Add two integers."

    def schema(self):
        return AddInput

    async def handle(self, arguments: dict) -> Response:
        return Response.text(str(arguments["a"] + arguments["b"]))


class GreetPrompt(Prompt):
    name = "greet"
    title = "Greeting"
    description = "Generates a personalised greeting."

    def arguments(self):
        return [Argument(name="name", description="Who to greet", required=True)]

    async def handle(self, arguments: dict) -> Response:
        return Response.text(f"Hello, {arguments.get('name', 'there')}!")


class StatusResource(Resource):
    uri = "resource:///status"
    name = "status"
    description = "Application status."
    mime_type = "application/json"

    async def read(self, **kwargs) -> str:
        return json.dumps({"status": "ok"})


class BlogServer(Server):
    name = "blog"
    description = "Read and manage blog posts."
    instructions = "Use the add tool to sum integers."

    def tools(self):
        return [AddTool]

    def prompts(self):
        return [GreetPrompt]

    def resources(self):
        return [StatusResource]


app = Application(base_path=Path(__file__).parent, providers=[FastAPIProvider, McpProvider])
app.include_router(BlogServer().router(prefix="/mcp"))
```

Point an MCP client at `POST /mcp`. It starts the session with `initialize`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "my-client", "version": "1.0"}
  }
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {"name": "blog", "version": "1.0"},
    "capabilities": {
      "tools": {"listChanged": false},
      "prompts": {"listChanged": false},
      "resources": {"listChanged": false}
    },
    "description": "Read and manage blog posts.",
    "instructions": "Use the add tool to sum integers."
  }
}
```
