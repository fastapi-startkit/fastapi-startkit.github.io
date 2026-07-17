---
outline: deep
title: AI Agents
description: Build declarative AI agents in FastAPI Startkit — a LangChain-powered agent module with support for Anthropic, OpenAI, and Google providers, tool calling, streaming, document attachments, structured output, middleware, and built-in testing utilities.
keywords: AI agents, Anthropic, OpenAI, Google Gemini, LLM, tool calling, streaming, FastAPI, fastapi-startkit, agent testing, structured output, middleware
---

# AI Agents

FastAPI Startkit includes a declarative, **LangChain-powered AI agent module** that lets you build provider-agnostic LLM agents as plain Python classes. Swap between Anthropic, OpenAI, and Google with a single environment variable; attach tools, documents, structured-output schemas, and middleware; and test everything offline with built-in faking and record/replay utilities.

## Introduction

An agent is a Python class that subclasses `Agent`, configures itself with decorators and overridable methods, and exposes an `async` `prompt()` / `stream()` API. Under the hood the module builds a LangChain chat model for the active provider, binds your tools, runs the request, and wraps the result in an `AgentResponse`.

**Supported providers:**

| Provider | `@provider` name | Default text model | LangChain integration package |
|---|---|---|---|
| Anthropic | `"anthropic"` | `claude-sonnet-4-6` | `langchain-anthropic` |
| OpenAI | `"openai"` | `gpt-4o` | `langchain-openai` |
| Google Gemini | `"google"` | `gemini-2.5-flash-lite` | `langchain-google-genai` |

> [!NOTE]
> The agent module is built on **LangChain** (`langchain` + `langchain-core`) and a small custom runner — not LangGraph. Models are created with `langchain.chat_models.init_chat_model`, so any provider LangChain supports can be wired in.

---

## Installation

Install the `ai` extra to pull in LangChain:

```bash
uv add "fastapi-startkit[ai]"
```

The `ai` extra installs `langchain` and `langchain-core` only. Provider SDKs are loaded lazily through LangChain's integration packages — install the one(s) for the provider you use:

```bash
uv add langchain-anthropic        # Anthropic
uv add langchain-openai           # OpenAI
uv add langchain-google-genai     # Google Gemini
```

### Registering the provider

Register `AIProvider` in your application bootstrap so the AI configuration is merged into the container under the `ai` key:

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

---

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

`AIProvider` reads these variables into an `AIConfig` dataclass and registers it under the `ai` config key:

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

Access the active configuration at runtime via the `AI` facade or the `Config` facade:

```python
from fastapi_startkit.facades import AI
from fastapi_startkit import Config

AI.config()        # the full AIConfig object
AI.default()       # the default provider name, e.g. "anthropic"
AI.providers()     # the per-provider config dict

Config.get("ai.providers.anthropic.key")          # dotted access
Config.get("ai.providers.google.models.default")  # "gemini-2.5-flash-lite"
```

---

## Creating an Agent

Subclass `Agent`, apply configuration decorators, and override the methods you need. Define your system prompt with `instructions()`:

```python
from fastapi_startkit.ai import Agent, provider, model, max_tokens

@provider("anthropic")
@model("claude-sonnet-4-6")
@max_tokens(2048)
class SupportAgent(Agent):
    def instructions(self) -> str:
        return "You are a friendly customer support assistant."

agent = SupportAgent()
response = await agent.prompt("How do I reset my password?")
print(response.content)  # "To reset your password, click …"
```

> [!IMPORTANT]
> `prompt()` and `stream()` are **async** — always `await` them (or iterate with `async for`). Call them from an `async` route or any coroutine.

### Overridable methods

Define an agent's behaviour by overriding these methods (all optional):

| Method | Returns | Purpose |
|---|---|---|
| `instructions()` | `str \| None` | The system prompt — leads the message list |
| `messages()` | `list[dict]` | Prior conversation turns to prepend |
| `tools()` | `list[BaseTool]` | LangChain tools the model may call |
| `schema()` | `type \| None` | Pydantic model for [structured output](#structured-output) |
| `middleware()` | `list` | [Middleware](#middleware-pipeline) layers wrapping each request |
| `provider_options()` | `dict` | Per-provider SDK options |

---

## Decorators Reference

Apply decorators to the class to configure it declaratively. Each sets a class attribute:

| Decorator | Default | Description |
|---|---|---|
| `@provider(name)` | `AI_PROVIDER` (default `google`) | LLM provider: `"anthropic"`, `"openai"`, `"google"` |
| `@model(name)` | provider default | Model identifier (e.g. `"claude-sonnet-4-6"`, `"gpt-4o"`) |
| `@max_tokens(n)` | `4096` | Maximum output tokens per response |
| `@max_steps(n)` | `10` | Maximum tool-call rounds |
| `@timeout(seconds)` | `30.0` | Per-request timeout in seconds |
| `@top_p(value)` | `1.0` | Top-p nucleus sampling parameter |

Decorators stack — apply as many as you need:

```python
@provider("openai")
@model("gpt-4o")
@max_tokens(1024)
@timeout(60.0)
class AnalysisAgent(Agent):
    ...
```

Equivalently, set the attributes directly on the class:

```python
class AnalysisAgent(Agent):
    provider = "openai"
    model = "gpt-4o"
    max_tokens = 1024
```

---

## prompt()

`Agent.prompt()` sends a user message and returns an `AgentResponse`:

```python
response = await agent.prompt("Summarise this lead and score it 1–10.")
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
) -> AgentResponse
```

### AgentResponse fields

| Field | Type | Description |
|---|---|---|
| `content` | `str` | The final text reply from the model |
| `tool_calls` | `list[dict]` | Tool calls the model returned on its final turn |
| `usage` | `dict` | Token counts: `{"input": n, "output": n}` |
| `raw` | `Any` | The raw runner result |
| `parsed` | `Any` | Validated schema instance when [`schema()`](#structured-output) is set, else `None` |

```python
response = await agent.prompt("Analyse Q3 revenue.")

print(response.content)     # text reply
print(response.text())      # same — convenience method
print(response.usage)       # {"input": 312, "output": 78}
data = response.json()      # parse content as JSON (raises if not valid JSON)
bool(response)              # True when content is non-empty
str(response)               # the content
```

---

## stream()

`Agent.stream()` is an async generator that yields response tokens as they arrive — ideal for server-sent events and live UIs:

```python
async for chunk in agent.stream("Write a follow-up email to the lead."):
    print(chunk, end="", flush=True)
```

### Signature

```python
async def stream(
    self,
    message: str,
    *,
    model: str | None = None,
    provider_options: dict | None = None,
) -> AsyncIterator[str]
```

### Streaming in FastAPI

Wrap the generator in a `StreamingResponse` to pipe tokens straight to the browser as SSE:

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.agents.chat import SupportAgent
from app.requests.chat import ChatRequest

api = APIRouter()

@api.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        async for chunk in SupportAgent().stream(request.message):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

When the agent uses tools, the stream yields the model's text tokens and then the tool results.

---

## Prompting

When you call `prompt()` or `stream()`, the agent assembles the message list in this order:

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

`instructions()` can be computed dynamically — it is a regular method, so you can pull in per-request context, the current user, or configuration.

---

## Tools

Tools are LangChain tools — define them with the `@tool` decorator from `langchain_core.tools` and return them from `tools()`. The docstring becomes the tool description and the type-annotated parameters build the JSON schema the model sees:

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
2. If the model responds with tool calls, the framework executes each tool.
3. The tool results are returned as the response content.

```python
agent = JobAgent()
response = await agent.prompt("Find me a python job")
print(response.content)   # the tool's output
```

> [!NOTE]
> A tool's name must be unique within an agent. Calling a tool the agent didn't register raises `ValueError`.

---

## Documents

Attach files to a `prompt()` call with the `Document` helper. Each document is converted to a LangChain content block and appended to the user message — text is inlined as a labelled text part, binary content (images, PDFs) becomes a base64 block the model reads natively.

```python
from fastapi_startkit.ai import Document

doc = Document(content="Q3 revenue was $1.2M …", name="q3-report.txt")
response = await agent.prompt("Summarise this report.", attachments=[doc])
```

### Loading documents

```python
# From a local file (text or binary — binary is detected automatically)
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

`Document` also exposes `to_bytes()`, `to_base64()`, and `to_langchain_block()` (called automatically by `prompt()`), plus `to_anthropic_block()` / `to_openai_block()` if you need provider-native blocks directly.

---

## Structured Output

Override `schema()` to return a Pydantic model. After the call, the model's JSON reply is validated into that schema and exposed on `response.parsed`:

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
response = await agent.prompt("Lead: Jane Doe, Acme Corp, interested in enterprise plan.")

summary = response.parsed          # a validated LeadSummary instance
print(summary.score)               # 8
print(summary.next_action)         # "Schedule demo call"
```

The schema is parsed from `response.content` (the raw JSON text). Instruct the model to return JSON that matches your schema — `schema()` validates the reply but does not itself constrain the model's output format. If the content can't be parsed into the schema, the call raises a validation error. When no schema is set, `response.parsed` is `None`.

> [!TIP]
> Structured output works with the testing helpers too: a faked or recorded JSON string is validated into the schema on the way out, so `response.parsed` is populated in tests.

---

## Middleware (Pipeline)

Override `middleware()` to wrap each LLM request in a pipeline. A middleware is any object with a `handle(self, model, handler)` method (sync or async). The pipeline composes them as an onion: the first item in the list is the **outermost** layer.

- `model` is the built **chat model** (a LangChain `BaseChatModel`) — inspect it, wrap it, or swap it.
- `handler(model)` continues the chain and returns a `Response` (a deferred, streaming-aware result).
- Attach an **after-hook** with `.then(callback)` and **return the `Response` without awaiting it** — this keeps streaming intact. The callback receives the final accumulated value once the response is complete.

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

You may return instances (as above) or classes — a class is instantiated with no arguments. For a pipeline `[Outer(), Inner()]`, the before-phase runs outer→inner and the after-hooks fire inner→outer.

> [!WARNING]
> Do **not** `await handler(model)` if you want to preserve streaming — awaiting buffers the entire response before any token is yielded. Use `return handler(model).then(callback)` instead. Awaiting is only appropriate when you deliberately want the full buffered result.

### After-hooks fire exactly once

`.then()` callbacks run exactly once whether the stream is fully drained **or** the consumer closes it early (e.g. a client disconnect or an early `break`). This makes them safe for logging, metrics, auditing, and cleanup. A middleware may also short-circuit the chain by returning a value directly from `handle()` instead of calling `handler`.

---

## Provider Options

Override `provider_options()` to pass provider-specific parameters, keyed by provider name. The options for the active provider are merged into the model's keyword arguments:

```python
@provider("anthropic")
class ThinkingAgent(Agent):
    def provider_options(self):
        return {
            "anthropic": {"thinking": {"type": "enabled", "budget_tokens": 1024}},
            "openai": {"frequency_penalty": 0.5},
        }
```

You can also pass `provider_options` per call to override for a single request:

```python
response = await agent.prompt(
    "Solve this hard maths problem.",
    provider_options={"anthropic": {"thinking": {"type": "enabled", "budget_tokens": 2048}}},
)
```

---

## Multiple Providers

Switch the active provider by setting `AI_PROVIDER` in `.env` — agents without an explicit `@provider` follow it:

```ini
AI_PROVIDER=anthropic   # or openai, google
```

Or pin a provider per agent with the decorator:

```python
@provider("openai")
class DraftAgent(Agent):
    """Always uses OpenAI, regardless of AI_PROVIDER."""

@provider("anthropic")
class ReviewAgent(Agent):
    """Always uses Anthropic, regardless of AI_PROVIDER."""
```

---

## Testing

`Agent.fake()` swaps in a deterministic chat model so `prompt()`/`stream()` run the real message-building, pipeline, and tool-execution path — only the model at the bottom is a fake, so faked tool calls execute for real. `Agent.record()` binds a record-and-replay stand-in into the container for the duration of a `with` block or a decorated test.

> [!NOTE]
> `Agent.record()` binds by class name. Resolve the agent with `YourAgent.make()` in code under test, or instantiate it directly (`YourAgent()`) — both pick up the binding while it is active. `Agent.fake()` works with any instance of the class, bound or not.

### Faking responses

`YourAgent.fake(responses)` is a classmethod that returns a context manager (also usable as a decorator). `responses` is a fixed, ordered list of replies — plain strings or LangChain messages (e.g. `AIMessage(..., tool_calls=[...])` to fake a tool call). Each call to `prompt()`/`stream()` replays the next reply in order; calling past the end of the list raises.

```python
# As a context manager
with SupportAgent.fake(["Click 'Forgot password' on the login page."]):
    response = await SupportAgent().prompt("How do I reset my password?")
    assert response.content == "Click 'Forgot password' on the login page."

# Multiple calls replay in order
with SupportAgent.fake(["first reply", "second reply"]):
    await SupportAgent().prompt("one")
    await SupportAgent().prompt("two")
```

Used as a decorator on a test (from the example app's controller test):

```python
class TestChatController(TestCase):
    @RouterAgent.fake(["Hello there, hope you are doing well."])
    async def test_it_responds_without_stream(self):
        response = await self.post("/chat", json={"message": "hello"})

        response.assert_ok()
        response.assert_contents("Hello there, hope you are doing well.")
```

A faked `stream()` still streams the reply in chunks so it behaves like a real token stream while re-joining to the exact value.

### Recording & replaying — record()

`YourAgent.record(cassette)` calls the **real agent on the first run**, saves the response to a JSON cassette, and **replays it from disk** on every subsequent run — fast, deterministic tests after the first recording. Responses are keyed by the conversation so far (seed messages plus prior turns in the session) and the new message (and any attachment names), so distinct prompts — even ones that share the same wording under a different history — are stored separately.

```python
class TestChatController(TestCase):
    @RouterAgent.record("record_no_stream.json")
    async def test_it_records_a_reply(self):
        response = await self.post(
            "/chat",
            json={"message": "Hi, I am Alex. Please respond by calling my name."},
        )
        response.assert_ok()
        response.assert_contents("Alex")
```

If you omit the path, a cassette is created next to the test file under `cassettes/<TestQualName>.json`. A relative path is resolved against the test file's directory. Streamed runs record the list of chunks; a later `prompt()` against the same cassette returns the joined content.

### Fluent record() — prompt() + assertions

Bind `record()` with `as agent` for a fluent handle whose `prompt()` is synchronous — no `async`/`await` needed — and whose `assert_*()` methods judge the most recent turn, similar to how a browser-testing `page` object exposes assertions against the current page state:

```python
class TestRouterAgent(TestCase):
    def test_the_router_agent(self):
        with RouterAgent.record("record_stream.json") as agent:
            agent.prompt("hello")
            agent.assert_text_response()
            agent.assert_tool_not_called(["job_search_tool"])
            agent.assert_response_judged(
                model="gpt-3.5-turbo",
                expectation="The llm should respond with greetings",
            )
            agent.assert_response_time_lt(5)

            agent.prompt("suggest python developer jobs")
            agent.assert_tool_called("job_search_tool", lambda tool: tool.name == "job_search_tool")
```

| Method | Description |
|---|---|
| `agent.prompt(message)` | Run (or replay) one turn synchronously; becomes the "current" turn for the assertions below |
| `agent.assert_text_response()` | Assert the current response has non-empty text content |
| `agent.assert_tool_called(name, predicate=None)` | Assert a tool named `name` was called in the current turn; `predicate` receives a `ToolCallView` (`.name`, `.args`, `.id`) for each match and must accept at least one |
| `agent.assert_tool_not_called(names)` | Assert none of `names` were called in the current turn |
| `agent.assert_response_time_lt(seconds)` | Assert the current turn's `prompt()` call took less than `seconds` |
| `agent.assert_response_judged(model=..., expectation=...)` | LLM-as-judge: grade the current response against a natural-language `expectation` using `model`. The verdict is cached in the cassette next to the recorded response, so replays after the first run need no live call |

Seed a conversation's prior history with `messages=` — plain dicts or LangChain message objects both work, and they're folded into the cassette key so a seeded session doesn't collide with an unseeded one that happens to send the same follow-up text:

```python
from langchain_core.messages import AIMessage, HumanMessage

with RouterAgent.record(
    "record_stream.json",
    messages=[
        HumanMessage(content="Hi"),
        AIMessage(content="Hello, how can I help you?"),
    ],
) as agent:
    agent.prompt("suggest python developer jobs")
    agent.assert_tool_called("job_search_tool", lambda tool: tool.name == "job_search_tool")
```

The bare (no `as agent`) usage from the previous section still works unchanged — it binds the same stand-in into the container so code under test that constructs `YourAgent()` itself (e.g. inside a controller) picks it up automatically.

### Assertions

The `Agent` instance tracks its own call log:

| Method | Description |
|---|---|
| `agent.assert_prompted()` | Assert `prompt()` or `stream()` was called at least once |
| `agent.assert_prompted(times=n)` | Assert exactly `n` calls |
| `agent.assert_not_prompted()` | Assert neither method was called |
| `agent.reset()` | Clear the call log (returns the agent for chaining) |

```python
async def test_agent_is_called_once():
    agent = SupportAgent()
    with SupportAgent.fake(["OK"]):
        await agent.prompt("Hello")
        agent.assert_prompted(times=1)
```

---

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

---

## Complete Example

A support agent with a tool, logging middleware, FastAPI routes, and a controller test — mirroring the structure of the `example/agents` app.

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

from app.agents.chat import RouterAgent
from app.requests.chat import ChatRequest

api = APIRouter()

@api.post("/chat")
async def chat(request: ChatRequest):
    response = await RouterAgent().prompt(request.message)
    return {"content": response.content}

@api.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        async for chunk in RouterAgent().stream(request.message):
            yield f"data: {chunk}\n\n"

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
