---
outline: deep
title: AI Agents
description: Build declarative AI agents in FastAPI Startkit — a LangChain-powered agent module with support for Anthropic, OpenAI, and Google providers, tool calling, streaming, document attachments, structured output, middleware, and built-in testing utilities.
keywords: AI agents, Anthropic, OpenAI, Google Gemini, LLM, tool calling, streaming, FastAPI, fastapi-startkit, agent testing, structured output, middleware
---

# AI Agents

## Introduction

An agent is a class that extends `Agent`. You configure it with decorators and by overriding methods, then call `await agent.prompt(...)` or iterate over `agent.stream(...)`. The agent builds a LangChain chat model for the active provider, binds your tools, and returns the turn as a LangChain-style `{"messages": [...]}` dict.

You can switch between Anthropic, OpenAI, and Google with one environment variable, and test agents offline with fakes and recorded cassettes.

| Provider | `@provider` name | Default text model | LangChain integration package |
|---|---|---|---|
| Anthropic | `"anthropic"` | `claude-sonnet-4-6` | `langchain-anthropic` |
| OpenAI | `"openai"` | `gpt-4o` | `langchain-openai` |
| Google Gemini | `"google"` | `gemini-2.5-flash-lite` | `langchain-google-genai` |

> [!NOTE]
> The agent module is built on LangChain (`langchain` and `langchain-core`) with a small custom runner instead of a LangGraph graph. Models are created with `langchain.chat_models.init_chat_model`, so any provider LangChain supports can be wired in.

## Installation

Install the `ai` extra to pull in LangChain:

```bash
uv add "fastapi-startkit[ai]"
```

> Python 3.12, 3.13, 3.14 and 3.15 are supported. The `fastapi-startkit[ai]` extra cannot be installed on Python 3.15 or newer yet, because its `langgraph` dependency requires `ormsgpack`, which does not support 3.15. Use Python 3.14 or older for the `ai` extra.

The `ai` extra installs `langchain` and `langchain-core` only. Provider SDKs are loaded lazily through LangChain's integration packages — install the one(s) for the provider you use:

```bash
uv add langchain-anthropic        # Anthropic
uv add langchain-openai           # OpenAI
uv add langchain-google-genai     # Google Gemini
```

### Registering the provider

Register `AIProvider` so the AI configuration is merged into the `ai` config key:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.ai import AIProvider

app: Application = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        # ... other providers
        AIProvider,
    ],
)
```

## Configuration

Add your API keys and the default provider to `.env`:

```ini
# .env
AI_PROVIDER=anthropic

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `google` | Active text provider: `anthropic`, `openai`, or `google` |
| `ANTHROPIC_API_KEY` | `""` | API key for Anthropic |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Anthropic API base URL |
| `OPENAI_API_KEY` | `""` | API key for OpenAI |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI API base URL |
| `GEMINI_API_KEY` | `""` | API key for Google Gemini (`GOOGLE_API_KEY` is also accepted) |

> [!TIP]
> `AI_DEFAULT_IMAGE_PROVIDER`, `AI_DEFAULT_AUDIO_PROVIDER`, and `AI_DEFAULT_TRANSCRIBE_PROVIDER` (each defaulting to `openai`) select the providers used by the [Image](./image) and [Audio](./audio) helpers.

### AIConfig overview

`AIProvider` reads these variables into an `AIConfig` dataclass under the `ai` config key:

```python
@dataclass
class AIConfig:
    default: str            # AI_PROVIDER            (default "google")
    default_image: str      # AI_DEFAULT_IMAGE_PROVIDER     (default "openai")
    default_audio: str      # AI_DEFAULT_AUDIO_PROVIDER     (default "openai")
    default_transcribe: str # AI_DEFAULT_TRANSCRIBE_PROVIDER (default "openai")

    providers: dict         # {"google": GoogleConfig(), "openai": OpenAIConfig(),
                            #  "anthropic": AnthropicConfig(), "elevenlabs": ElevenLabsConfig()}
```

Read it at runtime with the `Config` facade:

```python
from fastapi_startkit import Config

Config.get("ai.providers.anthropic.key")          # dotted access
Config.get("ai.providers.google.models.default")  # "gemini-2.5-flash-lite"
```

## Creating an Agent

Extend `Agent`, add decorators, and return your system prompt from `instructions()`:

```python
from fastapi_startkit.ai import Agent, provider, model, max_tokens, state

@provider("anthropic")
@model("claude-sonnet-4-6")
@max_tokens(2048)
class SupportAgent(Agent):
    def instructions(self) -> str:
        return "You are a friendly customer support assistant."

agent = SupportAgent()
result = await agent.prompt("How do I reset my password?")
print(state.text(result))  # "To reset your password, click …"
```

> [!IMPORTANT]
> `prompt()` is a coroutine and `stream()` is an async generator. `await` the first and iterate the second with `async for`.

### Overridable methods

All of these methods are optional:

| Method | Returns | Purpose |
|---|---|---|
| `instructions()` | `str \| None` | The system prompt, sent first in the message list |
| `messages()` | `list[dict]` | Prior conversation turns to prepend |
| `tools()` | `list[BaseTool]` | LangChain tools the model may call |
| `schema()` | `type \| None` | Pydantic model for [structured output](#structured-output) |
| `middleware()` | `list` | [Middleware](#middleware-pipeline) layers wrapping each request |
| `provider_options()` | `dict` | Per-provider SDK options |

## Decorators Reference

Each decorator sets a class attribute:

| Decorator | Default | Description |
|---|---|---|
| `@provider(name)` | `AI_PROVIDER` (default `google`) | LLM provider: `"anthropic"`, `"openai"`, `"google"` |
| `@model(name)` | provider default | Model identifier (e.g. `"claude-sonnet-4-6"`, `"gpt-4o"`) |
| `@max_tokens(n)` | `4096` | Maximum output tokens per response |
| `@max_steps(n)` | `10` | Stored on the agent but not read yet: the runner makes one model call and runs the requested tools once |
| `@timeout(seconds)` | `30.0` | Per-request timeout in seconds |
| `@top_p(value)` | `1.0` | Top-p nucleus sampling parameter |

Decorators can be stacked:

```python
@provider("openai")
@model("gpt-4o")
@max_tokens(1024)
@timeout(60.0)
class AnalysisAgent(Agent):
    ...
```

Or set the attributes on the class directly:

```python
class AnalysisAgent(Agent):
    provider = "openai"
    model = "gpt-4o"
    max_tokens = 1024
```

## prompt()

`Agent.prompt()` sends a user message and returns the turn as a dict:

```python
result = await agent.prompt("Summarise this lead and score it 1–10.")
```

### Signature

```python
async def prompt(
    self,
    message: str,
    *,
    model: str | None = None,            # override the model for this call only
    attachments: list[Document] | None = None,  # documents to include
    provider_options: dict | None = None,        # per-provider options for this call
) -> dict
```

### Reading the result

The result has the same shape as LangChain's `create_agent().invoke()`: `{"messages": [HumanMessage, AIMessage, ToolMessage, ...]}`, plus `"structured_response"` when the agent defines a [`schema()`](#structured-output). Read it with the helpers in `fastapi_startkit.ai.state`:

| Helper | Returns |
|---|---|
| `state.text(result)` | The last message's text: the model's answer, or the tool's result when a tool ran |
| `state.tool_calls(result)` | Every tool call the model requested |
| `state.tool_events(result)` | Each executed tool with its `name`, `args`, `content`, and `response_time` |
| `state.usage(result)` | Token counts: `{"input": n, "output": n}` |
| `state.runtime(result)` | Seconds spent on model and tool calls |
| `state.structured(result)` | The validated schema instance, or `None` |

```python
from fastapi_startkit.ai import state

result = await agent.prompt("Analyse Q3 revenue.")

print(state.text(result))   # text reply
print(state.usage(result))  # {"input": 312, "output": 78}
```

## stream()

`Agent.stream()` is an async generator. It yields the same event dicts as LangChain's `astream_events`: `on_chat_model_start`, `on_chat_model_stream`, and `on_chat_model_end` for the model turn, then `on_tool_start` and `on_tool_end` around each tool call. The text arrives in `on_chat_model_stream` events, in `event["data"]["chunk"]`:

```python
async for event in agent.stream("Write a follow-up email to the lead."):
    if event["event"] == "on_chat_model_stream":
        print(event["data"]["chunk"].text, end="", flush=True)
```

### Signature

```python
async def stream(
    self,
    message: str,
    *,
    model: str | None = None,
    provider_options: dict | None = None,
) -> AsyncIterator[dict]
```

### Streaming in FastAPI

Wrap the generator in a `StreamingResponse` to send the text to the browser as server-sent events:

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.agents.chat import SupportAgent
from app.requests.chat import ChatRequest

api = APIRouter()

@api.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        async for event in SupportAgent().stream(request.message):
            if event["event"] == "on_chat_model_stream" and (text := event["data"]["chunk"].text):
                yield f"data: {text}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

When the agent uses tools, the model events are followed by an `on_tool_start` and `on_tool_end` pair for each tool. The tool's result is in `event["data"]["output"]` of the `on_tool_end` event.

## Prompting

`prompt()` and `stream()` build the message list in this order:

1. The system message from `instructions()` (skipped when it returns `None`).
2. Any prior turns from `messages()`.
3. The user `message` you passed in.
4. A multimodal user message for any `attachments` (see [Documents](#documents)).

```python
class JobAssistant(Agent):
    def instructions(self) -> str:
        return "You help users find jobs."

    def messages(self) -> list[dict]:
        return [
            {"role": "user", "content": "I'm a Python developer."},
            {"role": "assistant", "content": "Great — what location?"},
        ]
```

A call to `await JobAssistant().prompt("Find me a job")` is sent as:

```python
[
    {"role": "system", "content": "You help users find jobs."},
    {"role": "user", "content": "I'm a Python developer."},
    {"role": "assistant", "content": "Great — what location?"},
    {"role": "user", "content": "Find me a job"},
]
```

`instructions()` is a regular method, so it can build the prompt from the current user, request data, or configuration.

## Tools

Tools are LangChain tools. Define them with `@tool` from `langchain_core.tools` and return them from `tools()`. The docstring becomes the tool's description, and the type hints become its input schema:

```python
# app/tools/job_search_tool.py
from langchain_core.tools import tool

@tool
def job_search_tool(query: str) -> list:
    """Search the job board for roles matching the query."""
    return search_jobs(query)
```

```python
# app/agents/chat.py
from typing import Callable

from fastapi_startkit.ai import Agent

from app.tools.job_search_tool import job_search_tool

class JobAgent(Agent):
    def instructions(self) -> str:
        return "You are a job-search assistant."

    def tools(self) -> list[Callable]:
        return [job_search_tool]
```

### How tool calls run

1. The agent binds your tools to the chat model and sends the message.
2. If the model responds with tool calls, the framework runs each tool once.
3. The turn ends with the tool results, so `state.text()` returns the last tool's output.

```python
agent = JobAgent()
result = await agent.prompt("Find me a python job")
print(state.text(result))   # the tool's output
```

> [!NOTE]
> A tool's name must be unique within an agent. Calling a tool the agent didn't register raises `ValueError`.

## Documents

Pass files to `prompt()` with the `Document` helper. Attachments are sent in an extra user message that repeats your text. A document whose `media_type` is `text/*` is inlined as a labelled text part; any other type, such as `image/png` or `application/pdf`, is sent as a base64 block.

```python
from fastapi_startkit.ai import Document

doc = Document(content="Q3 revenue was $1.2M …", name="q3-report.txt")
result = await agent.prompt("Summarise this report.", attachments=[doc])
```

### Loading documents

```python
# From a local file: text files load as str, binary files fall back to bytes
doc = Document.from_path("reports/q3.txt")

# From application storage (async) — reads storage/<key>
doc = await Document.from_storage("reports/q3.txt")

# From a URL (async, uses httpx)
doc = await Document.from_url("https://example.com/photo.jpg")
```

### Document fields

| Parameter | Type | Default | Description |
|---|---|---|---|
| `content` | `str \| bytes` | required | The document content (text or binary) |
| `name` | `str` | `""` | Display name / filename |
| `media_type` | `str` | `"text/plain"` | MIME type of the content |

The loaders don't detect the type: `media_type` stays `text/plain` unless you set it, for example `Document(content=png_bytes, name="chart.png", media_type="image/png")`.

`Document` also has `to_bytes()`, `to_base64()`, and `to_langchain_block()` (which `prompt()` calls for you), plus `to_anthropic_block()` and `to_openai_block()` for provider-native blocks.

## Structured Output

Return a Pydantic model from `schema()` to get a validated object back in `result["structured_response"]`:

```python
from pydantic import BaseModel
from fastapi_startkit.ai import Agent, provider, model

class LeadSummary(BaseModel):
    name: str
    company: str
    score: int          # 1–10
    next_action: str

@provider("anthropic")
@model("claude-sonnet-4-6")
class LeadAgent(Agent):
    def instructions(self) -> str:
        return (
            "Analyse the lead and reply with ONLY a JSON object matching: "
            '{"name": str, "company": str, "score": int, "next_action": str}.'
        )

    def schema(self):
        return LeadSummary

agent = LeadAgent()
result = await agent.prompt("Lead: Jane Doe, Acme Corp, interested in enterprise plan.")

summary = state.structured(result)  # a validated LeadSummary instance
print(summary.score)               # 8
print(summary.next_action)         # "Schedule demo call"
```

The model is called through LangChain's `with_structured_output()`, so providers that support it return data in the schema's shape. If that fails, the agent falls back to parsing JSON from the reply text, so it still helps to ask for JSON in your instructions. If the reply can't be parsed into the schema, `prompt()` raises a validation error. When no schema is set, `state.structured()` returns `None`.

> [!TIP]
> A faked or recorded JSON string is validated into the schema too, so `state.structured()` works in tests.

## Middleware (Pipeline)

Override `middleware()` to wrap each model request. A middleware is any object with a `handle(self, model, handler)` method, sync or async. The first item in the list is the outermost layer.

- `model` is the LangChain `BaseChatModel`. You can inspect it, wrap it, or replace it.
- `handler(model)` calls the next layer and returns a deferred `Response`.
- To run code after the response, attach a callback with `.then(callback)` and return the `Response` without awaiting it, so streaming still works. The callback receives the final value when the response completes.

```python
import time
from collections.abc import Callable
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel

from fastapi_startkit.logging import Logger

class AgentLogger:
    def handle(self, model: BaseChatModel, handler: Callable) -> Any:
        Logger.info(f"request | model={getattr(model, 'model', type(model).__name__)}")
        started_at = time.monotonic()

        def log_response(final: Any) -> None:
            elapsed = time.monotonic() - started_at
            meta = getattr(final, "usage_metadata", None) or {}
            Logger.info(f"response | {elapsed:.2f}s | out={meta.get('output_tokens', '?')} tokens")

        return handler(model).then(log_response)
```

Register middleware on the agent:

```python
from fastapi_startkit.ai import Agent, Middleware

from app.middleware.agent_logger import AgentLogger

class RouterAgent(Agent):
    def middleware(self) -> list[Middleware]:
        return [AgentLogger()]
```

You can return instances or classes; classes are instantiated with no arguments. For `[Outer(), Inner()]`, the code before `handler()` runs outer to inner, and the `.then()` callbacks run inner to outer.

> [!WARNING]
> Awaiting `handler(model)` buffers the whole response before any token is yielded, which breaks streaming. Return `handler(model).then(callback)` unless you want the buffered result.

### After-hooks fire exactly once

A `.then()` callback runs once, whether the stream is read to the end or closed early by a client disconnect or a `break`, so you can use it for logging, metrics, and cleanup. A middleware can also skip the rest of the chain by returning a value from `handle()` without calling `handler`.

## Provider Options

Return provider-specific parameters from `provider_options()`, keyed by provider name. The options for the agent's `@provider` are merged into the model's keyword arguments. Agents without `@provider` don't get these options:

```python
@provider("anthropic")
class ThinkingAgent(Agent):
    def provider_options(self):
        return {
            "anthropic": {"thinking": {"type": "enabled", "budget_tokens": 1024}},
            "openai": {"frequency_penalty": 0.5},
        }
```

Pass `provider_options` to `prompt()` to override them for one call:

```python
result = await agent.prompt(
    "Solve this hard maths problem.",
    provider_options={"anthropic": {"thinking": {"type": "enabled", "budget_tokens": 2048}}},
)
```

## Multiple Providers

Agents without `@provider` use the `AI_PROVIDER` setting:

```ini
AI_PROVIDER=anthropic   # or openai, google
```

Use the decorator to pin an agent to one provider:

```python
@provider("openai")
class DraftAgent(Agent):
    """Always uses OpenAI, regardless of AI_PROVIDER."""

@provider("anthropic")
class ReviewAgent(Agent):
    """Always uses Anthropic, regardless of AI_PROVIDER."""
```

## Testing

`Agent.fake()` replaces only the chat model. Message building, middleware, and tool execution still run, so a faked tool call executes the real tool. `Agent.record()` calls the real model once, saves the result to a cassette, and replays it on later runs.

> [!NOTE]
> `Agent.fake()` is keyed by class name, so any `YourAgent()` created inside the `with` block or decorated test is faked, including one built inside a controller. `Agent.record()` only records and replays calls made through the handle it returns (`with YourAgent.record(...) as agent`). Code that creates its own `YourAgent()` calls the real model.

### Faking responses

`YourAgent.fake(responses)` returns a context manager that also works as a decorator. `responses` is an ordered list of replies: strings, or LangChain messages such as `AIMessage(..., tool_calls=[...])` to fake a tool call. Each `prompt()` or `stream()` call uses the next reply, and calling past the end of the list raises an error.

```python
# As a context manager
with SupportAgent.fake(["Click 'Forgot password' on the login page."]):
    result = await SupportAgent().prompt("How do I reset my password?")
    assert state.text(result) == "Click 'Forgot password' on the login page."

# Multiple calls replay in order
with SupportAgent.fake(["first reply", "second reply"]):
    await SupportAgent().prompt("one")
    await SupportAgent().prompt("two")
```

As a decorator on a controller test:

```python
class TestChatController(TestCase):
    @RouterAgent.fake(["Hello there, hope you are doing well."])
    async def test_it_responds_without_stream(self):
        response = await self.post("/chat", json={"message": "hello"})

        response.assert_ok()
        response.assert_contents("Hello there, hope you are doing well.")
```

A faked `stream()` yields the reply in several chunks, like a real token stream.

### Recording & replaying — record()

`YourAgent.record(cassette)` calls the real model on the first run, saves each turn to a JSON cassette, and replays it from disk on later runs. Turns are keyed by the conversation so far, the new message, and any attachment names, so the same message after a different history is stored separately.

```python
class TestRouterAgent(IsolatedAsyncioTestCase):
    async def test_it_records_a_reply(self):
        with RouterAgent.record("record_no_stream.json") as agent:
            result = await agent.prompt("Hi, I am Alex. Please respond by calling my name.")
            assert "Alex" in state.text(result)
```

If you omit the path, the cassette is `cassettes/<Test_qualname>.json` next to the test file, with dots in the qualified name replaced by underscores. A relative path is resolved against the test file's directory. Streamed runs record the list of chunks, and a later `prompt()` against the same cassette returns the joined text.

### Fluent record() — prompt() + assertions

The handle's `assert_*()` methods check the most recent turn:

```python
class TestRouterAgent(IsolatedAsyncioTestCase):
    async def test_the_router_agent(self):
        with RouterAgent.record("record_stream.json") as agent:
            await agent.prompt("hello")
            agent.assert_text_response()
            agent.assert_tool_not_called(["job_search_tool"])
            await agent.assert_response_judged(
                model="gpt-3.5-turbo",
                expectation="The llm should respond with greetings",
            )
            agent.assert_response_time_lt(5)

            await agent.prompt("suggest python developer jobs")
            agent.assert_tool_called("job_search_tool", lambda tool: tool.name == "job_search_tool")
```

| Method | Description |
|---|---|
| `await agent.prompt(message)` | Run or replay one turn. It becomes the current turn for the assertions below |
| `agent.assert_text_response()` | The current response has text |
| `agent.assert_tool_called(name, predicate=None)` | A tool named `name` was called in the current turn. `predicate` receives an `AssertToolCall` (`.name`, `.args`, `.id`) for each match, and at least one must pass |
| `agent.assert_tool_not_called(names)` | None of `names` were called in the current turn |
| `agent.assert_response_time_lt(seconds)` | The recorded response times of all turns so far add up to less than `seconds` |
| `await agent.assert_response_judged(model=..., expectation=...)` | An LLM judge, using `model`, grades the current response against `expectation`. Verdicts are cached in a `<cassette>.judge.json` file next to the cassette, so replays don't call the judge again |

Seed earlier history with `messages=`, as dicts or LangChain messages. The seed is part of the cassette key, so a seeded session doesn't collide with an unseeded one that sends the same text:

```python
from langchain_core.messages import AIMessage, HumanMessage

with RouterAgent.record(
    "record_stream.json",
    messages=[
        HumanMessage(content="Hi"),
        AIMessage(content="Hello, how can I help you?"),
    ],
) as agent:
    await agent.prompt("suggest python developer jobs")
    agent.assert_tool_called("job_search_tool", lambda tool: tool.name == "job_search_tool")
```

### Assertions

The handles returned by `fake()` and `record()` count the calls made through them:

| Method | Description |
|---|---|
| `agent.assert_prompted()` | `prompt()` or `stream()` was called at least once |
| `agent.assert_prompted(times=n)` | Exactly `n` calls were made |
| `agent.assert_not_prompted()` | No calls were made |
| `agent.reset()` | Clear the call log and return the handle |

```python
async def test_agent_is_called_once():
    with SupportAgent.fake(["OK"]) as agent:
        await agent.prompt("Hello")
        agent.assert_prompted(times=1)
```

## Provider Backends

Models are created with LangChain's `init_chat_model`, which selects the integration package for the active provider. Install the matching package alongside `fastapi-startkit[ai]`:

### Anthropic

```bash
uv add langchain-anthropic
```

```ini
ANTHROPIC_API_KEY=sk-ant-...
```

### OpenAI

```bash
uv add langchain-openai
```

```ini
OPENAI_API_KEY=sk-...
```

### Google Gemini

```bash
uv add langchain-google-genai
```

```ini
GEMINI_API_KEY=AIza...   # GOOGLE_API_KEY also works
```

## Complete Example

A support agent with a tool, logging middleware, FastAPI routes, and a controller test, laid out like the `example/agents` app.

```python
# app/tools/job_search_tool.py
from langchain_core.tools import tool

@tool
def job_search_tool(query: str) -> list:
    """Search the job board for roles matching the query."""
    return search_jobs(query)
```

```python
# app/middleware/agent_logger.py
import time
from collections.abc import Callable
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel

from fastapi_startkit.logging import Logger

class AgentLogger:
    def handle(self, model: BaseChatModel, handler: Callable) -> Any:
        Logger.info(f"request | model={getattr(model, 'model', type(model).__name__)}")
        started_at = time.monotonic()

        def log_response(final: Any) -> None:
            Logger.info(f"response | {time.monotonic() - started_at:.2f}s")

        return handler(model).then(log_response)
```

```python
# app/agents/chat.py
from typing import Callable

from fastapi_startkit.ai import Agent, Middleware

from app.middleware.agent_logger import AgentLogger
from app.tools.job_search_tool import job_search_tool

class RouterAgent(Agent):
    def instructions(self) -> str:
        return "You are a friendly customer support assistant."

    def tools(self) -> list[Callable]:
        return [job_search_tool]

    def middleware(self) -> list[Middleware]:
        return [AgentLogger()]
```

```python
# routes/api.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from fastapi_startkit.ai import state

from app.agents.chat import RouterAgent
from app.requests.chat import ChatRequest

api = APIRouter()

@api.post("/chat")
async def chat(request: ChatRequest):
    result = await RouterAgent().prompt(request.message)
    return {"content": state.text(result)}

@api.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        async for event in RouterAgent().stream(request.message):
            if event["event"] == "on_chat_model_stream" and (text := event["data"]["chunk"].text):
                yield f"data: {text}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

```python
# tests/features/test_chat_controller.py
from app.agents.chat import RouterAgent

from tests.test_case import TestCase

class TestChatController(TestCase):
    @RouterAgent.fake(["Hello there, hope you are doing well."])
    async def test_it_responds_without_stream(self):
        response = await self.post("/chat", json={"message": "hello"})

        response.assert_ok()
        response.assert_contents("Hello there, hope you are doing well.")

    @RouterAgent.fake(["Hello there, this is stream chat."])
    async def test_it_responds_with_stream(self):
        response = await self.post("/chat/stream", json={"message": "hello"})

        response.assert_ok()
        response.assert_stream_contains("Hello there, this is stream chat.")
```
