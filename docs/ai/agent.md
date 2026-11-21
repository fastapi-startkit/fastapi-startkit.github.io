---
outline: deep
title: AI Agents
description: Build AI agents in FastAPI Startkit with Anthropic, OpenAI, Google, Bedrock and local providers, with tool calling, streaming, document attachments, structured output, classification, middleware, and testing helpers.
keywords: AI agents, classification, Decisions API, Anthropic, OpenAI, Google Gemini, LLM, tool calling, streaming, FastAPI, fastapi-startkit, agent testing, structured output, middleware
---

# AI Agents

An agent is a Python class that describes how to talk to a language model: its instructions, the tools it may call, and the shape of the answer you want back. You call `await agent.prompt(...)` for a full reply or iterate `agent.stream(...)` to show it as it's generated. The provider is configuration, so you can move an agent between Anthropic, OpenAI, Google, Bedrock or a local model without changing its code, and you can test it offline with fakes and recorded cassettes.

## Installation

Install the `ai` extra:

```bash
uv add "fastapi-startkit[ai]"
```

Then install the integration package for each provider you use:

| Provider | `@provider` name | Default text model | Install |
|---|---|---|---|
| Anthropic | `"anthropic"` | `claude-sonnet-4-6` | `uv add langchain-anthropic` |
| OpenAI | `"openai"` | `gpt-4o` | `uv add langchain-openai` |
| Google Gemini | `"google"` | `gemini-2.5-flash-lite` | `uv add langchain-google-genai` |
| Amazon Bedrock | `"bedrock"` | `AWS_BEDROCK_MODEL`, or `us.anthropic.claude-sonnet-4-6` | `uv add "fastapi-startkit[bedrock]"` |
| Ollama | `"ollama"` | `llama3.1` | `uv add "fastapi-startkit[ollama]"` |
| Any OpenAI-compatible server | your own name | your own | `uv add langchain-openai` |

### Registering the Provider {#registering-the-provider}

Register `AIProvider` in your application. It loads the AI configuration into the `ai` config key:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.ai import AIProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
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

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `google` | Provider for agents and [classification](#classification): any name under `providers`, such as `anthropic`, `openai`, `google`, `bedrock`, `ollama`, or a [custom provider](#custom-and-local-providers) |
| `ANTHROPIC_API_KEY` | `""` | API key for Anthropic |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Anthropic API base URL |
| `OPENAI_API_KEY` | `""` | API key for OpenAI |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI API base URL, used for chat, images and audio |
| `GEMINI_API_KEY` | `""` | API key for Google Gemini. `GOOGLE_API_KEY` is also accepted |
| `AWS_BEDROCK_MODEL` | `us.anthropic.claude-sonnet-4-6` | Bedrock text model |
| `AWS_REGION` | `""` | Bedrock region. `AWS_DEFAULT_REGION` is also accepted |
| `AWS_BEARER_TOKEN_BEDROCK` | `""` | Bedrock API key. You may use `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` or `AWS_PROFILE` instead |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |

`AI_DEFAULT_EMBEDDINGS_PROVIDER` picks the provider for [Embeddings](./embeddings), and defaults to `openai` independently of `AI_PROVIDER`. [Image](./image) and [Audio](./audio) use OpenAI.

### Config File

The settings live in an `AIConfig` dataclass. To change them, subclass it in `config/ai.py` and override only the fields you need:

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
    default_embeddings: str = env("AI_DEFAULT_EMBEDDINGS_PROVIDER", "openai")

    providers: dict[str, Config] = field(default_factory=lambda: {
        "google": GoogleConfig(models={
            "default": "gemini-2.5-flash",
            "default_embeddings": "gemini-embedding-001",
            "default_decisions": "gemini-decision-1",
        }),
        "openai": OpenAIConfig(),
        "anthropic": AnthropicConfig(),
        "elevenlabs": ElevenLabsConfig(),
        "bedrock": BedrockConfig(),
    })
```

This example keeps the framework defaults and changes Google's chat model to `gemini-2.5-flash`. Use `env()` only as a dataclass field default. Inside a dict such as `models`, write plain strings or call `os.getenv`. Then pass the class to `AIProvider`:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.ai import AIProvider

from config.ai import AIConfig

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        (AIProvider, AIConfig),
    ],
)
```

`AIProvider` merges your config over the defaults one top-level field at a time. A `providers` map you set replaces the default map as a whole, so list every provider you use.

### Custom and Local Providers {#custom-and-local-providers}

The key under `providers` is the provider's name, and its `driver` picks the integration. You can give a provider any name and select it with `AI_PROVIDER=<name>` or `@provider("<name>")`.

| Driver | Integration | Settings passed to the model |
|---|---|---|
| `anthropic`, `google`, `bedrock` | The provider's own integration package | `key`, plus the AWS settings for Bedrock |
| `openai` | OpenAI | `key` as `api_key`, `url` as `base_url` |
| `openai-compatible` | Any OpenAI-compatible server, such as LM Studio, vLLM, llama.cpp or Ollama's `/v1` | `url` as `base_url`, `key` as `api_key`. A placeholder key is sent when `key` is empty |
| `ollama` | Ollama's native API | `url` as `base_url` |

Use `OpenAICompatibleConfig` for a self-hosted server and `OllamaConfig` for Ollama:

```python
# config/ai.py
import os
from dataclasses import dataclass, field

from fastapi_startkit.ai import AIConfig as BaseAIConfig
from fastapi_startkit.ai import AnthropicConfig, OllamaConfig, OpenAICompatibleConfig, OpenAIConfig
from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env


@dataclass
class AIConfig(BaseAIConfig):
    default: str = env("AI_PROVIDER", "ollama")

    providers: dict[str, Config] = field(default_factory=lambda: {
        "openai": OpenAIConfig(),
        "anthropic": AnthropicConfig(),
        "local": OpenAICompatibleConfig(
            url=os.getenv("LOCAL_AI_URL", "http://localhost:1234/v1"),
            key=os.getenv("LOCAL_AI_API_KEY", ""),
            models={"default": "qwen2.5-7b-instruct", "default_embeddings": "nomic-embed-text"},
        ),
        "ollama": OllamaConfig(models={"default": "llama3.1", "default_embeddings": "nomic-embed-text"}),
    })
```

```ini
# .env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
LOCAL_AI_URL=http://localhost:1234/v1
```

Then point an agent at the provider by name:

```python
# app/agents/support_agent.py
from fastapi_startkit.ai import Agent, provider


@provider("local")
class SupportAgent(Agent):
    def instructions(self) -> str:
        return "You answer support questions."
```

The default `AIConfig` already registers `ollama`, so `AI_PROVIDER=ollama` works without a config file once Ollama is running and you've pulled `llama3.1`. Both drivers also work with [Embeddings](./embeddings). The [Image](./image) and [Audio](./audio) helpers support only their built-in providers. A provider with an unknown `driver` raises `ValueError` naming the provider and the driver.

### Provider Models

Each provider config has a `models` map with the default model for each feature. A `model` you pass to an agent, `Embeddings` or `classify()` overrides it.

| Key | Used by | `google` | `openai` | `anthropic` |
|---|---|---|---|---|
| `default` | Agents, and classification on non-Google providers | `gemini-2.5-flash-lite` | `gpt-4o` | `claude-sonnet-4-6` |
| `default_embeddings` | [Embeddings](./embeddings) | `gemini-embedding-001` | `text-embedding-3-small` | |
| `default_decisions` | [Classification](#classification) on Google | `gemini-decision-1` | | |

You can read any of these values with the `Config` facade:

```python
from fastapi_startkit.facades import Config

Config.get("ai.default")                                    # "google"
Config.get("ai.providers.google.models.default")            # "gemini-2.5-flash-lite"
Config.get("ai.providers.google.models.default_decisions")  # "gemini-decision-1"
```

## Creating Agents

To create an agent, extend `Agent`, add the decorators you need, and return your system prompt from `instructions()`:

```python
# app/agents/support_agent.py
from fastapi_startkit.ai import Agent, max_tokens, model, provider


@provider("anthropic")
@model("claude-sonnet-4-6")
@max_tokens(2048)
class SupportAgent(Agent):
    def instructions(self) -> str:
        return "You are a friendly customer support assistant."
```

### Overridable Methods

Beyond `instructions()`, you may override any of these methods. Each one is optional:

| Method | Returns | Purpose |
|---|---|---|
| `instructions()` | `str \| None` | The system prompt, sent first |
| `messages()` | `list[dict]` | Earlier conversation turns. May be `async`, for history you load from a database |
| `tools()` | `list` | [Tools](#tools) the model may call |
| `schema()` | `type \| None` | A Pydantic model for [structured output](#structured-output) |
| `middleware()` | `list` | [Middleware](#middleware-pipeline) that wraps each request |
| `provider_options()` | `dict` | [Provider options](#provider-options), keyed by provider name |

### Decorators

Each decorator sets a class attribute on the agent:

| Decorator | Default | Description |
|---|---|---|
| `@provider(name)` | `AI_PROVIDER` | Provider name from `ai.providers` |
| `@model(name)` | the provider's `default` model | Model identifier, such as `"gpt-4o"` |
| `@max_tokens(n)` | `4096` | Maximum output tokens per response |
| `@timeout(seconds)` | `30.0` | Request timeout in seconds |
| `@top_p(value)` | `1.0` | Nucleus sampling parameter |
| `@max_steps(n)` | `10` | Stored on the agent. A prompt makes one model call and runs the requested tools once, whatever the value |

You may stack as many decorators as you like, or set the same attributes on the class directly. `temperature` and `tool_choice` have no decorator, so set them as attributes:

```python
# app/agents/analysis_agent.py
from fastapi_startkit.ai import Agent


class AnalysisAgent(Agent):
    provider = "openai"
    model = "gpt-4o"
    max_tokens = 1024
    temperature = 0.2
    tool_choice = "auto"
```

## Prompting Agents

`prompt()` sends a user message to the model and returns the whole turn:

```python
from fastapi_startkit.ai import state

result = await SupportAgent().prompt("How do I reset my password?")

print(state.text(result))  # "To reset your password, click ..."
```

It accepts a few keyword arguments for a single call:

```python
async def prompt(
    self,
    message: str,
    *,
    model: str | None = None,
    attachments: list[Document] | None = None,
    provider_options: dict | None = None,
) -> dict
```

### Building the Conversation

`prompt()` and `stream()` send the messages in this order:

1. The system message from `instructions()`, unless it returns `None`.
2. The earlier turns from `messages()`.
3. The `message` you passed in.
4. One more user message with your text and any `attachments` (see [Documents](#documents)).

For example, this agent carries a short history:

```python
# app/agents/job_assistant.py
from fastapi_startkit.ai import Agent


class JobAssistant(Agent):
    def instructions(self) -> str:
        return "You help users find jobs."

    def messages(self) -> list[dict]:
        return [
            {"role": "user", "content": "I'm a Python developer."},
            {"role": "assistant", "content": "Great, what location?"},
        ]
```

A call to `await JobAssistant().prompt("Find me a job")` sends:

```python
[
    {"role": "system", "content": "You help users find jobs."},
    {"role": "user", "content": "I'm a Python developer."},
    {"role": "assistant", "content": "Great, what location?"},
    {"role": "user", "content": "Find me a job"},
]
```

`instructions()` is a regular method, so you can build the prompt from the current user, request data or configuration.

### Reading the Result {#reading-the-result}

The result is a dict with a `"messages"` list for the turn: your message, the model's reply, and one tool message per tool that ran. It also has `"structured_response"` when the agent defines a [`schema()`](#structured-output). Read it with the helpers in `fastapi_startkit.ai.state`:

| Helper | Returns |
|---|---|
| `state.text(result)` | The last message's text: the model's answer, or the tool's result when a tool ran |
| `state.messages(result)` | The turn's messages |
| `state.tool_calls(result)` | Every tool call the model requested |
| `state.tool_events(result)` | Each tool that ran, with its `name`, `args`, `id`, `content`, `content_type` and `response_time` |
| `state.usage(result)` | Token counts: `{"input": n, "output": n}` |
| `state.runtime(result)` | Seconds spent on model and tool calls |
| `state.structured(result)` | The validated schema instance, or `None` |

```python
from fastapi_startkit.ai import state

result = await agent.prompt("Analyse Q3 revenue.")

print(state.text(result))   # the reply
print(state.usage(result))  # {"input": 312, "output": 78}
```

## Streaming Responses

To show the reply as it's generated, call `stream()`. It takes the same `model` and `provider_options` arguments as `prompt()` and returns a `StreamableAgentResponse`. Iterating it yields event dicts: `on_chat_model_start`, `on_chat_model_stream` and `on_chat_model_end` for the model, then `on_tool_start` and `on_tool_end` around each tool call. The text arrives in `on_chat_model_stream` events:

```python
async for event in agent.stream("Write a follow-up email to the lead."):
    if event["event"] == "on_chat_model_stream":
        print(event["data"]["chunk"].text, end="", flush=True)
```

A stream can be consumed once. Iterating it again, or passing it to a second protocol, raises `RuntimeError` instead of running the agent and its tools a second time. Call `stream()` again for a new run.

### Stream Protocols {#stream-protocols}

Chat front-ends expect a specific wire format. Return the stream through a protocol and you get a Starlette `StreamingResponse` that a FastAPI route can return directly:

| Method | Front-end | Format |
|---|---|---|
| `using_vercel_data_protocol()` | Vercel AI SDK UI (`useChat`) | [UI message stream](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) over SSE |
| `using_agent_user_interaction_protocol(thread_id=None, run_id=None)` | CopilotKit and other [AG-UI](https://docs.ag-ui.com/) clients | AG-UI events over SSE |
| `using_protocol(protocol)` | Anything else | Your own `StreamProtocol` |

### Vercel AI SDK

```python
# routes/api.py
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

### AG-UI and CopilotKit

AG-UI clients such as `HttpAgent` and CopilotKit POST a `RunAgentInput` body with the `threadId`, the `runId` and the conversation so far. Accept it and forward the ids, so the events belong to the run the client started:

```python
# routes/api.py
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AgUiMessage(BaseModel):
    role: str
    content: str | None = None


class RunAgentInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    thread_id: str = Field(alias="threadId")
    run_id: str = Field(alias="runId")
    messages: list[AgUiMessage] = []
    state: Any = None


@api.post("/api/copilotkit")
async def copilot(run: RunAgentInput):
    prompt = next(m.content for m in reversed(run.messages) if m.role == "user" and m.content)
    return SalesCoach().stream(prompt).using_agent_user_interaction_protocol(
        thread_id=run.thread_id,
        run_id=run.run_id,
    )
```

The stream emits `RUN_STARTED`, `STEP_STARTED`, `TEXT_MESSAGE_START`/`CONTENT`/`END`, `REASONING_*`, `TOOL_CALL_START`/`ARGS`/`END`/`RESULT`, `STEP_FINISHED` and `RUN_FINISHED`. `TOOL_CALL_START` carries `parentMessageId` when the model wrote text before calling the tool. Without explicit ids, `threadId` falls back to the agent's `conversation_id` and then to the stream's `invocation_id`, and `runId` falls back to the `invocation_id`.

Set `conversation_id` on the agent when it belongs to a stored conversation:

```python
# app/agents/sales_coach.py
from fastapi_startkit.ai import Agent


class SalesCoach(Agent):
    def __init__(self, conversation_id: str | None = None):
        self.conversation_id = conversation_id
```

### Stream Errors

If the agent raises while streaming, the error is logged, any open text or reasoning part is closed, and the stream ends with a protocol error: an `error` part followed by `[DONE]` for Vercel, and `RUN_ERROR` without `RUN_FINISHED` for AG-UI. The browser receives `"An error occurred."`, so provider details don't leak. Override `error_text()` on `VercelDataProtocol` or `error_message()` on `AgentUserInteractionProtocol` to change it:

```python
# app/streaming/verbose_vercel_protocol.py
from fastapi_startkit.ai import VercelDataProtocol


class VerboseVercelProtocol(VercelDataProtocol):
    def error_text(self, error: Exception) -> str:
        return str(error)
```

```python
return SalesCoach().stream(message).using_protocol(VerboseVercelProtocol())
```

If the client disconnects, the agent stream is closed, and middleware `.then()` callbacks still run once.

### Custom Protocols

Extend `StreamProtocol` and implement `encode()`. `stream.events()` yields protocol-neutral events from `fastapi_startkit.ai.streaming`: `StreamStarted`, `StepStarted`, `TextStarted`, `TextDelta`, `TextEnded`, `ReasoningStarted`, `ReasoningDelta`, `ReasoningEnded`, `ToolInputStarted`, `ToolInputDelta`, `ToolInputAvailable`, `ToolOutputAvailable`, `StepFinished`, `StreamFinished` and `StreamFailed`. Text and reasoning parts are always opened and closed in order, and tool results are matched to their call by id and JSON-decoded when possible.

```python
# app/streaming/plain_text_protocol.py
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
```

```python
@api.post("/chat/plain")
async def plain(request: ChatRequest):
    return SalesCoach().stream(request.message).using_protocol(PlainTextProtocol())
```

`StreamProtocol` also gives you `sse(payload)` to format a server-sent event, `headers()` (`cache-control: no-cache` and `x-accel-buffering: no` by default) and `media_type` (`text/event-stream` by default).

### Streaming Raw Events

You can also iterate the stream yourself and build your own `StreamingResponse`:

```python
# routes/api.py
from fastapi.responses import StreamingResponse


@api.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        async for event in SupportAgent().stream(request.message):
            if event["event"] == "on_chat_model_stream" and (text := event["data"]["chunk"].text):
                yield f"data: {text}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

When a tool runs, its result is in `event["data"]["output"]` of the `on_tool_end` event.

## Tools

Tools let the model call your own code. Define them with `@tool` from `langchain_core.tools` and return them from `tools()`. The docstring becomes the tool's description, and the type hints become its input schema:

```python
# app/tools/job_search_tool.py
from langchain_core.tools import tool


@tool
def job_search_tool(query: str) -> list:
    """Search the job board for roles matching the query."""
    return search_jobs(query)
```

```python
# app/agents/job_agent.py
from fastapi_startkit.ai import Agent

from app.tools.job_search_tool import job_search_tool


class JobAgent(Agent):
    def instructions(self) -> str:
        return "You are a job-search assistant."

    def tools(self) -> list:
        return [job_search_tool]
```

When the model asks for a tool, the agent runs each requested tool once and the turn ends with the tool results. `state.text()` then returns the last tool's output, and `state.tool_events()` lists every tool that ran:

```python
result = await JobAgent().prompt("Find me a python job")

print(state.text(result))  # the tool's output
```

Tool names must be unique within an agent. If the model calls a tool the agent didn't register, `prompt()` raises `ValueError`.

## Documents {#documents}

To hand files to the model, pass `Document` instances as `attachments`. A document whose `media_type` is `text/*`, or whose content is a `str`, is inlined as a labelled text part. Any other type, such as `image/png` or `application/pdf`, is sent as a base64 block:

```python
from fastapi_startkit.ai import Document

doc = Document(content="Q3 revenue was $1.2M ...", name="q3-report.txt")

result = await agent.prompt("Summarise this report.", attachments=[doc])
```

### Loading Documents

You can load a document from a file, from application storage or from a URL:

```python
doc = Document.from_path("reports/q3.txt")                       # text loads as str, binary as bytes
doc = await Document.from_storage("reports/q3.txt")              # storage/<key>
doc = await Document.from_url("https://example.com/photo.jpg")   # downloads with httpx
```

The loaders don't detect the type, so `media_type` stays `text/plain` unless you set it:

```python
doc = Document(content=png_bytes, name="chart.png", media_type="image/png")
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `content` | `str \| bytes` | required | The document content |
| `name` | `str` | `""` | Display name or filename |
| `media_type` | `str` | `"text/plain"` | MIME type of the content |

`Document` also has `to_bytes()` and `to_base64()`, plus `to_anthropic_block()` and `to_openai_block()` when you call a provider SDK yourself.

## Structured Output {#structured-output}

When you want data instead of prose, return a Pydantic model from `schema()`. `state.structured()` then gives you a validated instance:

```python
# app/agents/lead_agent.py
from pydantic import BaseModel

from fastapi_startkit.ai import Agent


class LeadSummary(BaseModel):
    name: str
    company: str
    score: int
    next_action: str


class LeadAgent(Agent):
    def instructions(self) -> str:
        return "Analyse the lead and reply with a JSON object with name, company, score (1-10) and next_action."

    def schema(self):
        return LeadSummary
```

```python
result = await LeadAgent().prompt("Lead: Jane Doe, Acme Corp, interested in the enterprise plan.")

summary = state.structured(result)
summary.score        # 8
summary.next_action  # "Schedule demo call"
```

Providers that support structured output return data in the schema's shape. Otherwise the agent parses JSON from the reply text, so it helps to ask for JSON in your instructions. A reply that can't be parsed into the schema raises a Pydantic `ValidationError`. A faked or recorded JSON reply is validated the same way, so `state.structured()` works in tests.

## Classification {#classification}

Classification answers a fixed set of questions about one piece of text: is it urgent, which team owns it, how angry is the customer. You describe each question once and get back typed answers, already checked against the options you allowed:

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

All questions go to the provider in one request. How they're answered depends on the provider's driver:

| Driver | How it classifies | Confidence and probabilities |
|---|---|---|
| `google` | [Gemini Decisions API](https://aistudio.google.com/docs/decisions-api) | Yes, from the API |
| Any other | A [structured-output](#structured-output) agent using the provider's `default` model | No (`None`) |

The Decisions API scores each option instead of generating text.

### Choosing the Provider

`classify()` uses `AI_PROVIDER`, like agents do. Pass `provider` and `model` to override them for one call:

```python
await classification.classify(provider="openai", model="gpt-4.1-mini")
await classification.classify(provider="google", model="gemini-decision-1")
```

On Google, the model comes from `ai.providers.<name>.models.default_decisions`, and falls back to `gemini-decision-1` when that key isn't set. A `model` you pass on Google must be a Decisions model, not a chat model such as `gemini-2.5-flash`. The Google request needs `GEMINI_API_KEY` and nothing beyond the `ai` extra. Other providers need their integration package, as agents do.

### Questions

Question keys may use letters, digits, `_` and `-`, up to 64 characters, and you can ask up to 1,000 questions at once. A key may not name an attribute of the result, such as `model`, `provider`, `usage`, `state`, `answers`, `answer`, `to_dict`, `get`, `keys`, `items` or `values`. Those raise `ValueError`, so use a key such as `model_name` instead.

#### Boolean

A yes/no question. The answer is a `bool`. Descriptions for `true` and `false` are optional:

```python
Boolean("Did the item arrive damaged?")
Boolean("Is this spam?", {"true": "Unsolicited advertising", "false": "A real customer message"})
```

On Google, the answer is `True` when the API's probability of yes is at least 0.5.

#### Choice

Picks exactly one option, and the answer is the option's key. Give a description for each option, or pass a list of keys. You need 2 to 255 options, and each key must be 1 to 128 characters (at most 512 bytes in UTF-8) with no leading or trailing whitespace and no control characters:

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

On Google, the answer is the level with the highest probability, and the lower level wins a tie. The API's probability-weighted average, such as `1.1`, stays in `answer.raw["score"]` and is rounded to a level only when the response has no probabilities.

### Reading the Answers

`classify()` returns a `ClassificationResult`. It's a read-only mapping from question key to answer value, and each value is also an attribute:

```python
result["department"]   # "technical"
result.department      # "technical"
result.to_dict()       # {"urgent": True, "department": "technical", "frustration": 2}
```

Use `result["key"]` for keys that aren't valid Python names, such as `first-contact`. `result.answer(key)` returns the full `Answer`:

| Field | Description |
|---|---|
| `value` | The `bool`, the chosen key, or the level index |
| `label` | The description of that value: the `Boolean` description (or `"true"`/`"false"`), the option's description (or its key), or the level text |
| `confidence` | The API's confidence in the top answer. Google only, otherwise `None` |
| `probabilities` | Per-value probabilities: `{True: .., False: ..}`, `{key: ..}` or `{index: ..}`. Google only |
| `raw` | The provider's answer as returned |

```python
answer = result.answer("frustration")

answer.label          # "Very angry"
answer.confidence     # 0.74
answer.probabilities  # {0: 0.02, 1: 0.24, 2: 0.74}
```

The result also has `provider`, `model` and `usage` (`{"input": .., "output": ..}`, as [`state.usage()`](#reading-the-result) returns). On non-Google providers, `result.state` holds the agent's turn.

### Handling Classification Errors

Building a classification raises `ValueError` for empty question instructions or input, an empty question map, an invalid or reserved key, a value that isn't a question, `Boolean` description keys other than `true` and `false`, an invalid `Choice` option key, and fewer than two choices or levels.

A bad answer raises `ClassificationError`, a subclass of `ValueError`. The message names the failing question:

- an unknown choice, a score outside the scale, or a `Boolean` answer that isn't true or false
- a missing answer, or a Decisions answer of the wrong type
- a structured reply that doesn't match the questions
- a failed Decisions API request, including safety blocks, network errors, timeouts and a response that isn't a JSON object

```python
from fastapi_startkit.ai.classification import ClassificationError

try:
    result = await classification.classify()
except ClassificationError as error:
    ...
```

### Testing Classification

On Google, `Decisions.fake()` replaces only the HTTP call, so you still test the request your questions build and how the answers are read. Pass a list of response bodies, or a function that receives the payload. Each payload is recorded on `.requests`:

```python
# tests/test_triage.py
from fastapi_startkit.ai import Classification
from fastapi_startkit.ai.classification import Decisions


async def test_it_routes_outages_to_technical():
    fake = Decisions.fake([{
        "answers": {
            "urgent": {"type": "noul", "noul": 0.97, "confidence": 0.97},
            "department": {"type": "choice", "choice": "technical", "probabilities": {"technical": 0.9, "billing": 0.1}},
        },
    }])

    result = await Classification.of(text).questions(questions).classify()

    assert result.urgent is True
    assert fake.requests[0]["questions"]["department"]["type"] == "choice"
    Decisions.reset_fake()
```

For other providers, fake `ClassificationAgent` like any [agent](#faking-responses). The reply is a JSON object keyed by question, with `Score` answers given as level indices:

```python
from fastapi_startkit.ai.classification import ClassificationAgent

with ClassificationAgent.fake(['{"urgent": true, "department": "billing", "frustration": 1}']):
    result = await Classification.of(text).questions(questions).classify(provider="openai")
```

## Middleware {#middleware-pipeline}

Middleware runs code around every model request, for logging, metrics or swapping the model. Return your layers from `middleware()`. A middleware is any object with a `handle(self, model, handler)` method, sync or async.

`model` is the chat model about to be called, which you can inspect, wrap or replace. `handler(model)` calls the next layer and returns a deferred `Response`. To run code after the response, attach a callback with `.then(callback)` and return the `Response` without awaiting it. The callback receives the final value:

```python
# app/middleware/agent_logger.py
import time
from collections.abc import Callable
from typing import Any

from fastapi_startkit.logging import Log


class AgentLogger:
    def handle(self, model: Any, handler: Callable) -> Any:
        Log.info(f"request | model={getattr(model, 'model', type(model).__name__)}")
        started_at = time.monotonic()

        def log_response(final: Any) -> None:
            elapsed = time.monotonic() - started_at
            meta = getattr(final, "usage_metadata", None) or {}
            Log.info(f"response | {elapsed:.2f}s | out={meta.get('output_tokens', '?')} tokens")

        return handler(model).then(log_response)
```

Then register it on your agent:

```python
# app/agents/router_agent.py
from fastapi_startkit.ai import Agent, Middleware

from app.middleware.agent_logger import AgentLogger


class RouterAgent(Agent):
    def middleware(self) -> list[Middleware]:
        return [AgentLogger()]
```

You can return instances or classes. Classes are created with no arguments. For `[Outer(), Inner()]`, the code before `handler()` runs outer to inner, and the `.then()` callbacks run inner to outer.

A `.then()` callback runs exactly once, whether the stream is read to the end or closed early by a client disconnect or a `break`. A middleware can also skip the rest of the chain by returning a value without calling `handler`.

::: warning
Awaiting `handler(model)` buffers the whole response before any token reaches the client, which breaks streaming. Return `handler(model).then(callback)` unless you need the buffered result.
:::

## Provider Options

Each provider has its own settings, such as Anthropic's `thinking`. Return them from `provider_options()`, keyed by provider name. The options for the agent's `@provider` are passed to the model:

```python
# app/agents/thinking_agent.py
from fastapi_startkit.ai import Agent, provider


@provider("anthropic")
class ThinkingAgent(Agent):
    def provider_options(self):
        return {
            "anthropic": {"thinking": {"type": "enabled", "budget_tokens": 1024}},
            "openai": {"frequency_penalty": 0.5},
        }
```

To override them for a single call, pass `provider_options` to `prompt()` or `stream()`:

```python
result = await ThinkingAgent().prompt(
    "Solve this hard maths problem.",
    provider_options={"anthropic": {"thinking": {"type": "enabled", "budget_tokens": 2048}}},
)
```

::: warning
Provider options are matched by the agent's `provider` attribute. Set `@provider` on any agent that uses them: an agent that relies on `AI_PROVIDER` doesn't receive the options from `provider_options()`.
:::

## Using Multiple Providers

An agent without `@provider` uses `AI_PROVIDER`:

```ini
# .env
AI_PROVIDER=anthropic
```

When an agent should always use one provider, pin it with the decorator:

```python
# app/agents/review.py
from fastapi_startkit.ai import Agent, provider


@provider("openai")
class DraftAgent(Agent):
    def instructions(self) -> str:
        return "You write first drafts."


@provider("anthropic")
class ReviewAgent(Agent):
    def instructions(self) -> str:
        return "You review drafts for accuracy."
```

## Testing

Agents come with two testing helpers, so your tests don't call a real model each time:

- `YourAgent.fake(responses)` replaces only the chat model. Message building, middleware and tool execution still run, so a faked tool call runs the real tool.
- `YourAgent.record(cassette)` calls the real model once, saves the turn to a cassette, and replays it on later runs.

`fake()` is keyed by class name, so any `YourAgent()` created inside the `with` block or decorated test is faked, including one built inside a controller. `record()` only records calls made through the handle it returns. Code that creates its own `YourAgent()` calls the real model.

### Faking Responses {#faking-responses}

`fake()` returns a context manager that also works as a decorator. `responses` is an ordered list of replies: strings, or `AIMessage` objects with `tool_calls` to fake a tool call. Each `prompt()` or `stream()` uses the next reply, and calling past the end of the list raises `RuntimeError`:

```python
# tests/test_support_agent.py
from fastapi_startkit.ai import state

from app.agents.support_agent import SupportAgent


async def test_it_answers_password_questions():
    with SupportAgent.fake(["Click 'Forgot password' on the login page."]):
        result = await SupportAgent().prompt("How do I reset my password?")

    assert state.text(result) == "Click 'Forgot password' on the login page."


async def test_replies_replay_in_order():
    with SupportAgent.fake(["first reply", "second reply"]):
        first = await SupportAgent().prompt("one")
        second = await SupportAgent().prompt("two")

    assert state.text(second) == "second reply"
```

To fake a tool call, pass an `AIMessage`. The real tool runs with the arguments you give:

```python
# tests/test_job_agent.py
from langchain_core.messages import AIMessage

from app.agents.job_agent import JobAgent


async def test_it_searches_for_jobs():
    call = AIMessage(content="", tool_calls=[{"name": "job_search_tool", "args": {"query": "python"}, "id": "call_1"}])

    with JobAgent.fake([call]) as agent:
        await agent.prompt("Find me a python job")

        agent.assert_tool_called("job_search_tool", lambda tool: tool.args["query"] == "python")
```

As a decorator on a controller test:

```python
# tests/features/test_chat_controller.py
from app.agents.router_agent import RouterAgent

from tests.test_case import TestCase


class TestChatController(TestCase):
    @RouterAgent.fake(["Hello there, hope you are doing well."])
    async def test_it_responds_without_stream(self):
        response = await self.post("/chat", json={"message": "hello"})

        response.assert_ok()
        response.assert_contents("Hello there, hope you are doing well.")
```

A faked `stream()` yields the reply in several chunks, like a real token stream. Call `Ai.reset_fakes()` (from `fastapi_startkit.ai`) to clear every agent, embeddings and Decisions fake at once.

### Recording and Replaying

`record()` calls the real model on the first run, saves each turn to a JSON cassette, and replays it from disk afterwards. Turns are keyed by the conversation so far, the new message and the attachment names, so the same message after a different history is stored separately. The first run needs the provider's API key:

```python
# tests/test_router_agent.py
from fastapi_startkit.ai import state

from app.agents.router_agent import RouterAgent


async def test_it_records_a_reply():
    with RouterAgent.record("record_no_stream.json") as agent:
        result = await agent.prompt("Hi, I am Alex. Please respond by calling my name.")

    assert "Alex" in state.text(result)
```

If you omit the path, the cassette is `cassettes/<test_qualname>.json` next to the test file, with dots in the qualified name replaced by underscores. A relative path is resolved against the test file's directory. Streamed runs store their chunks, and replaying a stream yields them again.

To start from an existing conversation, seed earlier history with `messages=`, as dicts or message objects. The seed is part of the cassette key:

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
    agent.assert_tool_called("job_search_tool")
```

### Assertions

The handles returned by `fake()` and `record()` have `prompt()` and `stream()` methods and a set of assertions. Assertions about a response check the most recent turn made through the handle:

```python
async def test_the_router_agent():
    with RouterAgent.record("router.json") as agent:
        await agent.prompt("hello")

        agent.assert_text_response()
        agent.assert_tool_not_called(["job_search_tool"])
        agent.assert_response_time_lt(5)
        await agent.assert_relevant()

        await agent.prompt("suggest python developer jobs")
        agent.assert_tool_called("job_search_tool")
        agent.assert_follow_trajectory(["job_search_tool"])
```

| Method | Checks |
|---|---|
| `assert_prompted(times=None)` | The handle was prompted at least once, or exactly `times` times |
| `assert_not_prompted()` | The handle wasn't prompted |
| `assert_prompt(expected)` | A prompt contains `expected`, or satisfies it when `expected` is a callable |
| `assert_response(expected)` | The response text contains `expected` |
| `assert_text_response()` | The response has text |
| `assert_json()` | The response text is valid JSON |
| `assert_tool_called(name, predicate=None)` | A tool named `name` was called. `predicate` receives an `AssertToolCall` with `.name`, `.args` and `.id`, and at least one call must pass |
| `assert_tool_not_called(names)` | None of `names` were called |
| `assert_follow_trajectory(names)` | The tools called across every turn match `names`, in order |
| `assert_tokens(predicate)` | Token totals across every turn, for example `lambda x: x.where("input", "<=", 5000)` |
| `assert_response_time_lt(seconds)` | The recorded response times of every turn add up to less than `seconds` |
| `reset()` | Clears the history and totals and returns the handle |

A few assertions ask a judge model to grade the response. They're `async`, and they use the agent's provider and model unless you pass `provider=` or `model=`:

| Method | Checks |
|---|---|
| `await assert_response_judged(expectation=...)` | The response meets `expectation` |
| `await assert_satisfy(expectation)` | Same as `assert_response_judged` |
| `await assert_relevant()` | The response addresses the last prompt |
| `await assert_safe()` | The response is free of harmful content |
| `await assert_prompt_judged(expectation)` | The last prompt meets `expectation` |

Under `record()`, verdicts are saved to a `<cassette>.judge.json` file next to the cassette, so replays don't call the judge again.

## Complete Example

Here's a support agent with a tool, logging middleware, two routes and a controller test.

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

from fastapi_startkit.logging import Log


class AgentLogger:
    def handle(self, model: Any, handler: Callable) -> Any:
        Log.info(f"request | model={getattr(model, 'model', type(model).__name__)}")
        started_at = time.monotonic()

        def log_response(final: Any) -> None:
            Log.info(f"response | {time.monotonic() - started_at:.2f}s")

        return handler(model).then(log_response)
```

```python
# app/agents/router_agent.py
from fastapi_startkit.ai import Agent, Middleware

from app.middleware.agent_logger import AgentLogger
from app.tools.job_search_tool import job_search_tool


class RouterAgent(Agent):
    def instructions(self) -> str:
        return "You are a friendly customer support assistant."

    def tools(self) -> list:
        return [job_search_tool]

    def middleware(self) -> list[Middleware]:
        return [AgentLogger()]
```

```python
# routes/api.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from fastapi_startkit.ai import state

from app.agents.router_agent import RouterAgent
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
from app.agents.router_agent import RouterAgent

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

See [Image](./image), [Audio](./audio) and [Embeddings](./embeddings) for the other AI helpers, and [MCP](./mcp) to expose your app's tools to AI clients.
