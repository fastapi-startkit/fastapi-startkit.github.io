---
outline: deep
title: AI Agents
description: Build declarative AI agents in FastAPI Startkit on top of LangChain, with Anthropic, OpenAI, and Google providers, tool calling, streaming, document attachments, structured output, middleware, and built-in testing helpers.
keywords: AI agents, classification, Decisions API, Anthropic, OpenAI, Google Gemini, LLM, tool calling, streaming, FastAPI, fastapi-startkit, agent testing, structured output, middleware
---

# AI Agents

## Introduction

FastAPI Startkit lets you describe an AI agent as a plain Python class. Each agent extends `Agent`; you configure it with a few decorators and by overriding methods, then call `await agent.prompt(...)` or iterate over `agent.stream(...)`. Behind the scenes, the agent builds a LangChain chat model for the active provider, binds your tools, and returns the turn as a LangChain-style `{"messages": [...]}` dict.

Because the provider is just configuration, you can move between Anthropic, OpenAI, and Google by changing one environment variable. And when it's time to write tests, you can run your agents offline with fakes and recorded cassettes.

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

The `ai` extra installs only `langchain` and `langchain-core`. Provider SDKs are loaded lazily through LangChain's integration packages, so you only need to install the ones for the providers you actually use:

```bash
uv add langchain-anthropic        # Anthropic
uv add langchain-openai           # OpenAI
uv add langchain-google-genai     # Google Gemini
```

### Registering the provider

Next, register `AIProvider` in your application. It merges the AI configuration into the `ai` config key:

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
| `AI_DEFAULT_DECISIONS_PROVIDER` | `google` | Provider used by [Classification](#classification): `google` (Decisions API), `openai`, `anthropic`, or `bedrock` |

> [!TIP]
> `AI_DEFAULT_IMAGE_PROVIDER`, `AI_DEFAULT_AUDIO_PROVIDER`, `AI_DEFAULT_TRANSCRIBE_PROVIDER`, and `AI_DEFAULT_EMBEDDINGS_PROVIDER` (each defaulting to `openai`) select the providers used by the [Image](./image), [Audio](./audio) and [Embeddings](./embeddings) helpers. Each feature picks its provider on its own, independently of `AI_PROVIDER`.

### Config file

The AI settings live in an `AIConfig` dataclass, and every field reads its value from `.env` through `env()`. To change them, keep your own config in `config/ai.py`, as you do for the [database](/docs/database/#configuration). Subclass the framework's `AIConfig` and override only the fields you need:

```python
# config/ai.py
from dataclasses import dataclass, field

from fastapi_startkit.ai import AIConfig as BaseAIConfig
from fastapi_startkit.ai import AnthropicConfig, BedrockConfig, ElevenLabsConfig, GoogleConfig, OpenAIConfig
from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env


@dataclass
class AIConfig(BaseAIConfig):
    default: str = env("AI_PROVIDER", "google")
    default_image: str = env("AI_DEFAULT_IMAGE_PROVIDER", "openai")
    default_audio: str = env("AI_DEFAULT_AUDIO_PROVIDER", "openai")
    default_transcribe: str = env("AI_DEFAULT_TRANSCRIBE_PROVIDER", "openai")
    default_embeddings: str = env("AI_DEFAULT_EMBEDDINGS_PROVIDER", "openai")
    default_decisions: str = env("AI_DEFAULT_DECISIONS_PROVIDER", "google")

    providers: dict[str, Config] = field(default_factory=lambda: {
        "google": GoogleConfig(models={
            "default": "gemini-2.5-flash",
            "default_image": "imagen-3.0-generate-002",
            "default_embeddings": "gemini-embedding-001",
            "default_decisions": "gemini-decision-1",
        }),
        "openai": OpenAIConfig(),
        "anthropic": AnthropicConfig(),
        "elevenlabs": ElevenLabsConfig(),
        "bedrock": BedrockConfig(),
    })
```

Each `env(name, default)` field reads the variable when the config is created and uses the default when it is unset. The example keeps the framework defaults, except for Google's chat model, which changes to `gemini-2.5-flash`. Use `env()` only as a dataclass field default: inside a dict such as `models` it is not resolved, so write those values as plain strings. Then pass the class to `AIProvider`:

```python
# bootstrap/application.py
from config.ai import AIConfig
from fastapi_startkit.ai import AIProvider

app: Application = Application(
    base_path=...,
    providers=[
        (AIProvider, AIConfig),
    ],
)
```

`AIProvider` merges your config over the defaults one top-level field at a time. A `providers` map you set replaces the default map as a whole, so list every provider you use.

### Provider models

Each provider config has a `models` map with the default model for each feature. A `model` passed to an agent, `Image`, `Embeddings` or `classify()` overrides it.

| Key | Used by | `google` | `openai` | `anthropic` |
|---|---|---|---|---|
| `default` | Agents, classification on chat providers | `gemini-2.5-flash-lite` | `gpt-4o` | `claude-sonnet-4-6` |
| `default_image` | [Image](./image) | `imagen-3.0-generate-002` | `dall-e-3` | |
| `default_embeddings` | [Embeddings](./embeddings) | `gemini-embedding-001` | `text-embedding-3-small` | |
| `default_decisions` | [Classification](#classification) on Google | `gemini-decision-1` | | |

You can read any of these values at runtime with the `Config` facade:

```python
from fastapi_startkit import Config

Config.get("ai.providers.anthropic.key")          # dotted access
Config.get("ai.providers.google.models.default")  # "gemini-2.5-flash-lite"
Config.get("ai.providers.google.models.default_decisions")  # "gemini-decision-1"
```

## Creating an Agent

To create an agent, extend `Agent`, add any decorators you need, and return your system prompt from `instructions()`:

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
> `prompt()` is a coroutine and `stream()` returns a streamable response. `await` the first and iterate the second with `async for`, or return it from a route through a [stream protocol](#stream-protocols).

### Overridable methods

Beyond `instructions()`, you can override any of the following methods. Every one of them is optional:

| Method | Returns | Purpose |
|---|---|---|
| `instructions()` | `str \| None` | The system prompt, sent first in the message list |
| `messages()` | `list[dict]` | Prior conversation turns to prepend |
| `tools()` | `list[BaseTool]` | LangChain tools the model may call |
| `schema()` | `type \| None` | Pydantic model for [structured output](#structured-output) |
| `middleware()` | `list` | [Middleware](#middleware-pipeline) layers wrapping each request |
| `provider_options()` | `dict` | Per-provider SDK options |

## Decorators Reference

Each decorator sets a class attribute on the agent:

| Decorator | Default | Description |
|---|---|---|
| `@provider(name)` | `AI_PROVIDER` (default `google`) | LLM provider: `"anthropic"`, `"openai"`, `"google"` |
| `@model(name)` | provider default | Model identifier (e.g. `"claude-sonnet-4-6"`, `"gpt-4o"`) |
| `@max_tokens(n)` | `4096` | Maximum output tokens per response |
| `@max_steps(n)` | `10` | Stored on the agent but not read yet: the runner makes one model call and runs the requested tools once |
| `@timeout(seconds)` | `30.0` | Per-request timeout in seconds |
| `@top_p(value)` | `1.0` | Top-p nucleus sampling parameter |

You may stack as many decorators as you like:

```python
@provider("openai")
@model("gpt-4o")
@max_tokens(1024)
@timeout(60.0)
class AnalysisAgent(Agent):
    ...
```

If you prefer, you can set the same attributes on the class directly:

```python
class AnalysisAgent(Agent):
    provider = "openai"
    model = "gpt-4o"
    max_tokens = 1024
```

## prompt()

The `Agent.prompt()` method sends a user message to the model and returns the whole turn as a dict:

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

The result has the same shape as LangChain's `create_agent().invoke()`: `{"messages": [HumanMessage, AIMessage, ToolMessage, ...]}`, plus `"structured_response"` when the agent defines a [`schema()`](#structured-output). Rather than digging through the messages yourself, you can read it with the helpers in `fastapi_startkit.ai.state`:

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

When you want to show the reply as it's generated, use `Agent.stream()`. It returns a `StreamableAgentResponse`; iterating it yields the same event dicts as LangChain's `astream_events`: `on_chat_model_start`, `on_chat_model_stream`, and `on_chat_model_end` for the model turn, then `on_tool_start` and `on_tool_end` around each tool call. The text arrives in `on_chat_model_stream` events, in `event["data"]["chunk"]`:

```python
async for event in agent.stream("Write a follow-up email to the lead."):
    if event["event"] == "on_chat_model_stream":
        print(event["data"]["chunk"].text, end="", flush=True)
```

### Signature

```python
def stream(
    self,
    message: str,
    *,
    model: str | None = None,
    provider_options: dict | None = None,
) -> StreamableAgentResponse
```

### Stream protocols

Chat front-ends expect a specific wire format. Instead of translating LangChain events by hand, return the stream through a protocol. Each method returns a Starlette `StreamingResponse`, so a FastAPI route can return it directly.

| Method | Front-end | Format |
|---|---|---|
| `using_vercel_data_protocol()` | Vercel AI SDK UI (`useChat`) | [UI message stream](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) over SSE |
| `using_agent_user_interaction_protocol(thread_id=None, run_id=None)` | CopilotKit and other [AG-UI](https://docs.ag-ui.com/) clients | AG-UI events over SSE |
| `using_protocol(protocol)` | Anything else | Your own `StreamProtocol` |

#### Vercel AI SDK

```python
from fastapi import APIRouter

from app.agents.sales_coach import SalesCoach
from app.requests.chat import ChatRequest

api = APIRouter()

@api.post("/api/chat")
async def chat(request: ChatRequest):
    return SalesCoach().stream(request.message).using_vercel_data_protocol()
```

The response carries the `x-vercel-ai-ui-message-stream: v1` header and streams `start`, `start-step`, `text-*`, `reasoning-*`, `tool-input-start`, `tool-input-delta`, `tool-input-available`, `tool-output-available`, `finish-step` and `finish` parts, ending with `data: [DONE]`. Point `useChat` at the route:

```tsx
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});
```

#### AG-UI and CopilotKit

```python
@api.post("/api/copilotkit")
async def copilot(request: ChatRequest):
    return SalesCoach().stream(request.message).using_agent_user_interaction_protocol()
```

The stream emits `RUN_STARTED`, `STEP_STARTED`, `TEXT_MESSAGE_START`/`CONTENT`/`END`, `REASONING_*`, `TOOL_CALL_START`/`ARGS`/`END`/`RESULT`, `STEP_FINISHED` and `RUN_FINISHED`. `threadId` defaults to the agent's `conversation_id` and then to the stream's `invocation_id`; `runId` defaults to the `invocation_id`. Pass your own ids to override them:

```python
SalesCoach().stream(message).using_agent_user_interaction_protocol(thread_id=thread_id, run_id=run_id)
```

Set `conversation_id` on the agent when it belongs to a stored conversation:

```python
class SalesCoach(Agent):
    def __init__(self, conversation_id: str):
        self.conversation_id = conversation_id
```

#### Errors

If the agent raises while streaming, the error is logged and the stream ends with a protocol error event: an `error` part followed by `[DONE]` for the Vercel protocol, and `RUN_ERROR` (without `RUN_FINISHED`) for AG-UI. The message sent to the browser is `"An error occurred."` so provider details do not leak. Override `error_text()` on `VercelDataProtocol` or `error_message()` on `AgentUserInteractionProtocol` to change it:

```python
from fastapi_startkit.ai import VercelDataProtocol

class VerboseVercelProtocol(VercelDataProtocol):
    def error_text(self, error: Exception) -> str:
        return str(error)

return SalesCoach().stream(message).using_protocol(VerboseVercelProtocol())
```

If the client disconnects, the agent stream is closed, so middleware `.then()` callbacks still run once.

#### Custom protocols

Extend `StreamProtocol` and implement `encode()`. `stream.events()` yields protocol-neutral events from `fastapi_startkit.ai.streaming`: `StreamStarted`, `StepStarted`, `TextStarted`, `TextDelta`, `TextEnded`, `ReasoningStarted`, `ReasoningDelta`, `ReasoningEnded`, `ToolInputStarted`, `ToolInputDelta`, `ToolInputAvailable`, `ToolOutputAvailable`, `StepFinished`, `StreamFinished` and `StreamFailed`. Text and reasoning parts are always opened and closed in order, and tool results arrive JSON-decoded when possible.

```python
from collections.abc import AsyncIterator

from fastapi_startkit.ai import StreamableAgentResponse, StreamProtocol
from fastapi_startkit.ai.streaming import StreamFailed, TextDelta, ToolOutputAvailable

class PlainTextProtocol(StreamProtocol):
    media_type = "text/plain"

    async def encode(self, stream: StreamableAgentResponse) -> AsyncIterator[str]:
        async for event in stream.events():
            match event:
                case TextDelta(delta=delta):
                    yield delta
                case ToolOutputAvailable(name=name, output=output):
                    yield f"\n[{name}] {output}\n"
                case StreamFailed():
                    yield "\n[error]"

@api.post("/chat/plain")
async def plain(request: ChatRequest):
    return SalesCoach().stream(request.message).using_protocol(PlainTextProtocol())
```

`StreamProtocol` provides `sse(payload)` to format a server-sent event, `headers()` (`cache-control: no-cache` and `x-accel-buffering: no` by default) and `media_type` (`text/event-stream` by default).

### Streaming raw events

You can still iterate the stream and build your own `StreamingResponse`:

```python
from fastapi.responses import StreamingResponse

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

Both `prompt()` and `stream()` build the message list in the same order:

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

With that agent, a call to `await JobAssistant().prompt("Find me a job")` is sent as:

```python
[
    {"role": "system", "content": "You help users find jobs."},
    {"role": "user", "content": "I'm a Python developer."},
    {"role": "assistant", "content": "Great — what location?"},
    {"role": "user", "content": "Find me a job"},
]
```

Since `instructions()` is a regular method, you're free to build the prompt from the current user, request data, or configuration.

## Tools

Tools let the model call your own code, and they're ordinary LangChain tools. Define them with `@tool` from `langchain_core.tools` and return them from `tools()`. The docstring becomes the tool's description, and the type hints become its input schema:

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

You can hand files to the model by passing `Document` instances to `prompt()`. Attachments are sent in an extra user message that repeats your text. A document whose `media_type` is `text/*` is inlined as a labelled text part; any other type, such as `image/png` or `application/pdf`, is sent as a base64 block.

```python
from fastapi_startkit.ai import Document

doc = Document(content="Q3 revenue was $1.2M …", name="q3-report.txt")
result = await agent.prompt("Summarise this report.", attachments=[doc])
```

### Loading documents

You can also load a document from a file, from application storage, or from a URL:

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

Sometimes you want data rather than prose. Return a Pydantic model from `schema()` and you'll get a validated object back in `result["structured_response"]`:

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

## Classification

Classification answers a fixed set of questions about one piece of text: is it urgent, which team owns it, how angry is the customer. It builds on [structured output](#structured-output): you describe each question once, and you get back typed answers that are already checked against the options you allowed.

```python
from fastapi_startkit.ai import Classification
from fastapi_startkit.ai.classification import Boolean, Choice, Score

result = await Classification.of(support_request).questions({
    "urgent": Boolean("Does this request need an immediate response?", {
        "true": "Explicitly time-sensitive",
        "false": "No urgency expressed",
    }),
    "department": Choice("Which team should handle this request?", {
        "billing": "Payments, invoices, and refunds",
        "technical": "Bugs, outages, and integrations",
        "sales": "Pricing, plans, and upgrades",
    }),
    "frustration": Score("How frustrated is the customer?", ["Calm", "Frustrated", "Very angry"]),
}).classify()

result["urgent"]       # True
result.department      # "technical"
result["frustration"]  # 2
```

All questions go to the provider in one request. How they are answered depends on the provider:

| Provider | How it classifies | Confidence and probabilities |
|---|---|---|
| `google` | [Gemini Decisions API](https://aistudio.google.com/docs/decisions-api) with `gemini-decision-1` | Yes, calibrated by the API |
| `openai`, `anthropic`, `bedrock` | A structured-output [agent](#structured-output) | No (`None`) |

The Decisions API scores each option instead of generating text, and it bills input tokens only.

### Classification Settings

Classification picks its provider from `AI_DEFAULT_DECISIONS_PROVIDER` (`AIConfig.default_decisions`, default `google`), not from `AI_PROVIDER`. That way an app can chat through Anthropic and still classify through the Decisions API. If you have no Google key, point it at your chat provider:

```ini
AI_DEFAULT_DECISIONS_PROVIDER=openai
```

> [!IMPORTANT]
> On Google, classification needs `GEMINI_API_KEY` (or `GOOGLE_API_KEY`). If the key is empty, `classify()` raises a `ClassificationError` naming `GEMINI_API_KEY` and `AI_DEFAULT_DECISIONS_PROVIDER` before anything is sent. Set the key, or point `AI_DEFAULT_DECISIONS_PROVIDER` at a provider you have configured. Passing `provider=` to `classify()` and `Decisions.fake()` in tests don't need the Google key.

The API keys come from [Configuration](#configuration). On Google, the model comes from `ai.providers.google.models.default_decisions` (`gemini-decision-1`), and the request only needs `httpx`, which the `ai` extra already installs. The other providers use their chat model and LangChain package, as agents do.

### Questions

Question keys may use letters, digits, `_` and `-`, up to 64 characters. This is the Decisions API's rule, and it applies to every provider so your questions stay portable. You can ask up to 1,000 questions at once.

A key may not name an attribute of the result: `model`, `provider`, `usage`, `state`, `answers`, `answer`, `to_dict`, `get`, `keys`, `items`, `values`, or a dunder name such as `__init__`. These raise `ValueError`, because `result.model` would return the model name instead of your answer. Use a key such as `model_name` instead.

#### Boolean

A yes/no question. The answer is a `bool`. Descriptions for `true` and `false` are optional and help the model decide:

```python
Boolean("Did the item arrive damaged?")
Boolean("Is this spam?", {"true": "Unsolicited advertising", "false": "A real customer message"})
```

On Google, the answer is `True` when the API's probability of yes (`noul`) is at least 0.5.

#### Choice

Picks exactly one option. The answer is the option's key. Give a description for each option, or pass a list of keys. You need 2 to 255 options. Each option key must be 1 to 128 characters (at most 512 bytes in UTF-8), with no leading or trailing whitespace and no control characters. These are the Decisions API's rules, and they apply to every provider.

```python
Choice("Which team should handle this request?", {
    "billing": "Payments, invoices, and refunds",
    "technical": "Bugs, outages, and integrations",
})
Choice("What language is this?", ["en", "de", "fr"])
```

#### Score

Places the text on an ordered scale. List 2 to 255 levels from lowest to highest. The answer is the level's index, starting at `0`:

```python
Score("How frustrated is the customer?", ["Calm", "Frustrated", "Very angry"])
```

On Google, the answer is the level with the highest probability, so it always agrees with `answer.confidence`. On a tie, the lower level wins. The API also returns a probability-weighted average of the level indices, such as `1.1`; it stays in `answer.raw["score"]` and is only rounded to a level when the response has no probabilities. The average can point at a level the API rated unlikely: `{0: 0.45, 1: 0.0, 2: 0.55}` averages to `1.1`, but the answer is `2`.

Probabilities keyed by level text (`"Calm"`) are mapped to level indices like those keyed by index (`"0"`). A probability for an unknown level raises `ClassificationError`.

### Reading the Classification

`classify()` returns a `ClassificationResult`. It is a read-only mapping from question key to answer value, and each value is also available as an attribute:

```python
result["department"]   # "technical"
result.department      # "technical"
result.to_dict()       # {"urgent": True, "department": "technical", "frustration": 2}
```

> Use `result["key"]` for keys that are not valid Python names (`first-contact`). Keys that would clash with the result's own attributes (`model`, `provider`, `usage`, `state`, `answers`, `answer`, `to_dict`, `get`, `keys`, `items`, `values`) are rejected when you call `questions()`, so `result.<key>` always returns your answer.

`result.answer(key)` returns the full `Answer`:

| Field | Description |
|---|---|
| `value` | `bool`, the chosen key, or the level index |
| `label` | The description of that value: the `Boolean` description (or `"true"`/`"false"`), the option's description (or its key), or the level text |
| `confidence` | The probability that the top answer is right. Google only, otherwise `None` |
| `probabilities` | Per-value probabilities: `{True: .., False: ..}`, `{key: ..}` or `{index: ..}`. Google only |
| `raw` | The provider's answer object as returned |

```python
answer = result.answer("frustration")
answer.label           # "Very angry"
answer.confidence      # 0.74
answer.probabilities   # {0: 0.02, 1: 0.24, 2: 0.74}
```

The result also carries `provider`, `model` and `usage` (`{"input": .., "output": ..}`, the same shape as [`state.usage()`](#reading-the-result)). On the structured-output path, `result.state` holds the agent's turn.

### Choosing the Classification Provider

`classify()` uses `AI_DEFAULT_DECISIONS_PROVIDER` unless you pass a `provider`. It takes the same `provider` and `model` overrides as agents:

```python
await classification.classify(provider="openai", model="gpt-4.1-mini")
await classification.classify(provider="google", model="gemini-decision-1")
```

On Google, `model` names a Decisions model, not a chat model such as `gemini-2.5-flash`.

### Classification Errors

Building a classification raises `ValueError` for empty instructions or input, an empty question map, an invalid or reserved key, a value that is not a question, unknown `Boolean` description keys, an invalid `Choice` option key, and fewer than two choices or levels.

A bad answer raises `ClassificationError` (a `ValueError`) with the question's key in the message:

- an unknown choice, a score outside the scale, or a `Boolean` answer that is not `true`/`false`;
- a missing answer, or a Decisions answer of the wrong type;
- a structured reply that does not match the schema; the message includes the validation error and names the failing question;
- a failed Decisions API request, including safety blocks (`failed with 400: safety: ...`), network errors and timeouts (`request failed: ConnectError: ...`), and a response that is not a JSON object.

```python
from fastapi_startkit.ai.classification import ClassificationError

try:
    result = await classification.classify()
except ClassificationError as error:
    ...
```

### Testing Classification

Both paths can be faked without calling a model.

On Google, `Decisions.fake()` replaces only the HTTP call. You still test the request your questions build and how the answers are read. Pass a list of response bodies, or a function that receives the payload. Each payload is recorded on `.requests`:

```python
from fastapi_startkit.ai.classification import Decisions

fake = Decisions.fake([{
    "answers": {
        "urgent": {"type": "noul", "noul": 0.97, "confidence": 0.97},
        "department": {"type": "choice", "choice": "technical", "probabilities": {"technical": 0.9, "billing": 0.1}},
    },
}])

result = await Classification.of(text).questions(questions).classify()

assert result.urgent is True
assert fake.requests[0]["questions"]["department"]["type"] == "choice"
```

Call `Decisions.reset_fake()` (or `Ai.reset_fakes()`) when the test ends.

For other providers, fake the `ClassificationAgent` like any [agent](#faking-responses). The reply is a JSON object keyed by question, with `Score` answers given as level indices:

```python
from fastapi_startkit.ai.classification import ClassificationAgent

with ClassificationAgent.fake(['{"urgent": true, "department": "billing", "frustration": 1}']):
    result = await Classification.of(text).questions(questions).classify(provider="openai")
```

See the [Gemini Decisions API](https://aistudio.google.com/docs/decisions-api) reference for the Google endpoint.

## Middleware (Pipeline)

Middleware gives you a place to run code around every model request, which is handy for logging, metrics, or swapping the model. Override `middleware()` to return your layers. A middleware is any object with a `handle(self, model, handler)` method, sync or async, and the first item in the list is the outermost layer.

The `model` argument is the LangChain `BaseChatModel`, which you can inspect, wrap, or replace. Calling `handler(model)` invokes the next layer and returns a deferred `Response`. To run code after the response, attach a callback with `.then(callback)` and return the `Response` without awaiting it, so streaming keeps working. The callback receives the final value when the response completes.

```python
import time
from collections.abc import Callable
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel

from fastapi_startkit.logging import Log

class AgentLogger:
    def handle(self, model: BaseChatModel, handler: Callable) -> Any:
        Log.info(f"request | model={getattr(model, 'model', type(model).__name__)}")
        started_at = time.monotonic()

        def log_response(final: Any) -> None:
            elapsed = time.monotonic() - started_at
            meta = getattr(final, "usage_metadata", None) or {}
            Log.info(f"response | {elapsed:.2f}s | out={meta.get('output_tokens', '?')} tokens")

        return handler(model).then(log_response)
```

Then register the middleware on your agent:

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

Each provider has its own settings, such as Anthropic's `thinking` option below. You can pass them by returning provider-specific parameters from `provider_options()`, keyed by provider name. The options for the agent's `@provider` are merged into the model's keyword arguments. Agents without `@provider` don't get these options:

```python
@provider("anthropic")
class ThinkingAgent(Agent):
    def provider_options(self):
        return {
            "anthropic": {"thinking": {"type": "enabled", "budget_tokens": 1024}},
            "openai": {"frequency_penalty": 0.5},
        }
```

To override them for a single call, pass `provider_options` to `prompt()`:

```python
result = await agent.prompt(
    "Solve this hard maths problem.",
    provider_options={"anthropic": {"thinking": {"type": "enabled", "budget_tokens": 2048}}},
)
```

## Multiple Providers

Any agent without a `@provider` decorator uses the `AI_PROVIDER` setting:

```ini
AI_PROVIDER=anthropic   # or openai, google
```

When an agent should always use a particular provider, pin it with the decorator:

```python
@provider("openai")
class DraftAgent(Agent):
    """Always uses OpenAI, regardless of AI_PROVIDER."""

@provider("anthropic")
class ReviewAgent(Agent):
    """Always uses Anthropic, regardless of AI_PROVIDER."""
```

## Testing

Calling a real model in every test would be slow and expensive, so agents come with two testing helpers. `Agent.fake()` replaces only the chat model. Message building, middleware, and tool execution still run, so a faked tool call executes the real tool. `Agent.record()` calls the real model once, saves the result to a cassette, and replays it on later runs.

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

You can also use it as a decorator on a controller test:

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

The handle returned by `record()` also has a set of `assert_*()` methods, each of which checks the most recent turn:

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

To start from an existing conversation, seed earlier history with `messages=`, as dicts or LangChain messages. The seed is part of the cassette key, so a seeded session doesn't collide with an unseeded one that sends the same text:

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

Both `fake()` and `record()` return handles that count the calls made through them, so you can assert how often an agent was prompted:

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

Models are created with LangChain's `init_chat_model`, which picks the integration package for the active provider. For each provider you use, install the matching package alongside `fastapi-startkit[ai]` and set its API key.

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

To tie everything together, here's a support agent with a tool, logging middleware, FastAPI routes, and a controller test, laid out like the `example/agents` app.

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

from fastapi_startkit.logging import Log

class AgentLogger:
    def handle(self, model: BaseChatModel, handler: Callable) -> Any:
        Log.info(f"request | model={getattr(model, 'model', type(model).__name__)}")
        started_at = time.monotonic()

        def log_response(final: Any) -> None:
            Log.info(f"response | {time.monotonic() - started_at:.2f}s")

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
