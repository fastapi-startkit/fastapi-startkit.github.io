---
outline: deep
title: AI Agents
description: Build declarative AI agents in FastAPI Startkit — a LangGraph-powered agent framework with support for Anthropic, OpenAI, and Google providers, tool calling, streaming, document attachments, and built-in testing utilities.
keywords: AI agents, Anthropic, OpenAI, Google Gemini, LLM, tool calling, streaming, FastAPI, fastapi-startkit, agent testing, structured output
---

# AI Agents

FastAPI Startkit includes a declarative, LangGraph-powered **AI agent module** that lets you build provider-agnostic LLM agents as plain Python classes. Swap between Anthropic, OpenAI, and Google with a single environment variable; attach tools, documents, and lifecycle hooks; and test everything offline with built-in faking and snapshot utilities.

## Introduction

An agent is a Python class that subclasses `Agent`, configures itself with decorators, and exposes a clean `prompt()` / `stream()` API. The framework handles the agentic loop — calling tools, feeding results back to the model, and stopping when the model is done.

**Supported providers:**

| Provider | Default model | SDK |
|---|---|---|
| `anthropic` | `claude-sonnet-4-6` | `anthropic` |
| `openai` | `gpt-4o` | `openai` |
| `google` | `gemini-2.0-flash` | `google-generativeai` |

---

## Installation

Install the `ai` extra to pull in the provider SDKs you need:

```bash
# All provider SDKs
pip install "fastapi-startkit[ai]"

# Or install only what you need
pip install "fastapi-startkit[ai-anthropic]"  # Anthropic only
pip install "fastapi-startkit[ai-openai]"     # OpenAI only
pip install "fastapi-startkit[ai-google]"     # Google only
```

### Registering the provider

Register `AIProvider` in your application bootstrap:

```python
# bootstrap/application.py
from fastapi_startkit import Application
from fastapi_startkit.ai import AIProvider

app = Application(
    base_path=...,
    providers=[
        # ... other providers
        AIProvider,
    ]
)
```

---

## Configuration

Add your API keys and default provider to `.env`:

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
| `AI_PROVIDER` | `google` | Active provider: `anthropic`, `openai`, or `google` |
| `ANTHROPIC_API_KEY` | — | API key for Anthropic |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Anthropic API base URL (override for proxies) |
| `OPENAI_API_KEY` | — | API key for OpenAI |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI API base URL (override for proxies / Azure) |
| `GEMINI_API_KEY` | — | API key for Google Gemini (`GOOGLE_API_KEY` is also accepted) |

### AIConfig overview

The framework reads these variables into a structured `AIConfig` dataclass:

```python
@dataclass
class AIConfig:
    default: str  # active provider from AI_PROVIDER

    providers: dict = {
        "anthropic": AnthropicConfig(key=..., url=...),
        "openai":    OpenAIConfig(key=..., url=...),
        "google":    GoogleConfig(key=...),
    }
```

You can access the active provider at runtime via the `AI` facade:

```python
from fastapi_startkit.facades import AI

config = AI.config()          # returns AIConfig
provider = config.default     # e.g. "anthropic"
```

---

## Creating an Agent

Subclass `Agent`, apply configuration decorators, and override lifecycle methods:

```python
from fastapi_startkit.ai import Agent, provider, model, max_tokens

@provider("anthropic")
@model("claude-sonnet-4-6")
@max_tokens(2048)
class SupportAgent(Agent):
    def messages(self):
        return [
            {
                "role": "system",
                "content": "You are a friendly customer support assistant.",
            }
        ]

agent = SupportAgent()
response = agent.prompt("How do I reset my password?")
print(response)  # "To reset your password, click …"
```

The `prompt()` method runs the full **agentic loop**: if the model calls tools, they are executed and the results are fed back until the model returns a final answer or `_max_steps` is reached.

---

## Decorators Reference

Apply decorators directly to the class to configure it declaratively:

| Decorator | Default | Description |
|---|---|---|
| `@provider(name)` | `AI_PROVIDER` env var (default: `google`) | LLM provider: `"anthropic"`, `"openai"`, or `"google"` |
| `@model(name)` | provider default | Model identifier (e.g. `"claude-sonnet-4-6"`, `"gpt-4o"`) |
| `@max_tokens(n)` | `4096` | Maximum output tokens per response |
| `@max_steps(n)` | `10` | Maximum agentic loop iterations before stopping |
| `@timeout(seconds)` | `30.0` | Per-request timeout in seconds |
| `@top_p(value)` | `1.0` | Top-p nucleus sampling parameter |
| `@memory(backend)` | `""` | Named memory backend (reserved for future use) |

All decorators stack cleanly — apply as many as you need:

```python
@provider("openai")
@model("gpt-4o")
@max_tokens(1024)
@max_steps(5)
@timeout(60.0)
class AnalysisAgent(Agent):
    ...
```

---

## prompt()

`Agent.prompt()` sends a user message and returns an `AgentResponse` after running the full agentic tool loop:

```python
response = agent.prompt("Summarise this lead and score it 1–10.")
```

### Optional keyword arguments

| Argument | Type | Description |
|---|---|---|
| `system` | `str \| None` | Override the system prompt for this call only |
| `model` | `str \| None` | Override the model for this call only |
| `messages` | `list[dict] \| None` | Extra conversation history to prepend |
| `attachments` | `list[Document] \| None` | Documents to include with the message |
| `provider_options` | `dict \| None` | Per-provider options merged for this call only |

### AgentResponse fields

| Field | Type | Description |
|---|---|---|
| `content` | `str` | The final text reply from the model |
| `tool_calls` | `list[dict]` | Tool calls made during the last step (name + input) |
| `usage` | `dict` | Token counts: `{"input": n, "output": n}` |
| `raw` | `Any` | The raw SDK response object |

```python
response = agent.prompt("Analyse Q3 revenue.")

print(response.content)          # text reply
print(response.text())           # same — convenience method
print(response.usage)            # {"input": 312, "output": 78}
print(response.tool_calls)       # [{"name": "lookup_db", "input": {...}}]
data = response.json()           # parse content as JSON (if model returned JSON)
```

---

## stream()

`Agent.stream()` yields response tokens one at a time — ideal for server-sent events and live UI updates:

```python
for chunk in agent.stream("Write a follow-up email to the lead."):
    print(chunk, end="", flush=True)
```

### StreamingResponse in FastAPI

Wrap the generator in a `StreamingResponse` to pipe tokens directly to the browser:

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.post("/chat")
def chat(body: ChatRequest):
    agent = SupportAgent()

    def token_generator():
        for chunk in agent.stream(body.message):
            yield chunk

    return StreamingResponse(token_generator(), media_type="text/plain")
```

> [!NOTE]
> Tool execution is **not supported during streaming**. If your agent uses tools, call `prompt()` instead — it runs the full agentic loop and returns a final `AgentResponse`.

---

## Tools

Define plain Python functions as tools. Each function must have:

- A **docstring** (becomes the tool description)
- **Type-annotated parameters** (used to build the JSON schema)

The framework auto-wraps them into the Anthropic tool schema format:

```python
def lookup_product(product_id: str) -> str:
    """Look up a product by its ID and return its name and price."""
    product = Product.find(product_id)
    return f"{product.name}: ${product.price}"

def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to the given address."""
    mailer.send(to=to, subject=subject, body=body)
    return "Email sent."

@provider("anthropic")
@model("claude-sonnet-4-6")
class SalesAgent(Agent):
    def messages(self):
        return [{"role": "system", "content": "You are a sales assistant."}]

    def tools(self):
        return [lookup_product, send_email]
```

### How the agentic loop works

1. The model receives the user message plus tool definitions.
2. If the model decides to call a tool, `prompt()` executes it and feeds the result back.
3. Steps 2–3 repeat until the model returns a final text reply or `_max_steps` is reached.

```python
agent = SalesAgent()
response = agent.prompt("Look up product P-42 and email alice@example.com about it.")

print(response.content)      # final text reply after tools were called
print(response.tool_calls)   # list of tool calls made in the last step
```

---

## Documents

Attach files to a `prompt()` call using the `Document` helper. Documents are sent as Anthropic content blocks alongside the user message.

```python
from fastapi_startkit.ai import Document

doc = Document(content="Q3 revenue was $1.2M …", name="q3-report.txt")
response = agent.prompt("Summarise this report.", attachments=[doc])
```

### Loading from disk

```python
doc = Document.from_path("reports/q3.txt")
response = agent.prompt("What are the key takeaways?", attachments=[doc])
```

### Loading from application storage

```python
doc = Document.from_storage("reports/q3.txt")  # resolves to storage/reports/q3.txt
```

### Document fields

| Parameter | Type | Default | Description |
|---|---|---|---|
| `content` | `str` | required | The document text content |
| `name` | `str` | `""` | Display name / filename |
| `media_type` | `str` | `"text/plain"` | MIME type of the content |

### to_anthropic_block()

`doc.to_anthropic_block()` returns the Anthropic-format content block dict. This is called automatically by `prompt()` — you rarely need it directly.

---

## Structured Output

Override `schema()` to force the model to return a valid Pydantic model instance. The framework instructs the model to respond in JSON matching the schema, then parses and validates the output.

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
    def messages(self):
        return [{"role": "system", "content": "Analyse leads and return JSON."}]

    def schema(self):
        return LeadSummary

agent = LeadAgent()
response = agent.prompt("Lead: Jane Doe, Acme Corp, interested in enterprise plan.")
summary = LeadSummary(**response.json())   # validated Pydantic model
print(summary.score)      # 8
print(summary.next_action) # "Schedule demo call"
```

---

## Lifecycle Hooks

Override `before()` and `after()` to transform messages and responses at the class level.

### before()

Called with the user message **before** it is sent to the provider. Return the (possibly modified) message string:

```python
class LoggingAgent(Agent):
    def before(self, message: str) -> str:
        print(f"[agent] sending: {message[:80]}")
        return message.strip()
```

### after()

Called with the `AgentResponse` **after** the provider replies. Return the (possibly modified) response:

```python
class SanitisedAgent(Agent):
    def after(self, response: AgentResponse) -> AgentResponse:
        response.content = response.content.replace("<script>", "")
        return response
```

---

## Middleware

Override `middleware()` to return a list of callables that wrap each LLM request. Middleware follows a `(message, next)` convention — call `next(message)` to continue the chain and return the result.

```python
import time

def rate_limit(message: str, next) -> AgentResponse:
    """Throttle requests to avoid hitting provider rate limits."""
    time.sleep(0.5)
    return next(message)

def audit_log(message: str, next) -> AgentResponse:
    """Log every request to the audit trail."""
    print(f"[audit] prompt: {message[:120]}")
    response = next(message)
    print(f"[audit] response tokens: {response.usage.get('output')}")
    return response

class AuditedAgent(Agent):
    def middleware(self):
        return [rate_limit, audit_log]
```

Middleware is applied **left-to-right**: `rate_limit` runs first, then `audit_log`, then the LLM call.

---

## Provider Options

Override `provider_options()` to pass provider-specific parameters keyed by provider name. These are merged into the SDK call kwargs.

```python
@provider("anthropic")
class ThinkingAgent(Agent):
    def provider_options(self):
        return {
            "anthropic": {
                "thinking": {"type": "enabled", "budget_tokens": 1024},
            },
            "openai": {
                "frequency_penalty": 0.5,
            },
        }
```

You can also pass `provider_options` per-call to override for a single request:

```python
response = agent.prompt(
    "Solve this hard maths problem.",
    provider_options={"anthropic": {"thinking": {"type": "enabled", "budget_tokens": 2048}}},
)
```

---

## Multiple Providers

Switch the active provider at runtime by setting `AI_PROVIDER` in `.env`. No code changes required — the `@provider` decorator on each agent class already selects the right backend:

```ini
# Use Anthropic by default
AI_PROVIDER=anthropic
```

```ini
# Switch everything to OpenAI
AI_PROVIDER=openai
```

Or override per-agent:

```python
@provider("openai")
class DraftAgent(Agent):
    """Uses GPT-4o regardless of AI_PROVIDER."""
    ...

@provider("anthropic")
class ReviewAgent(Agent):
    """Always uses Claude regardless of AI_PROVIDER."""
    ...
```

---

## Testing

### Faking responses

Call `agent.fake()` with a dict of glob-pattern → `AgentResponse` pairs. Patterns are matched case-insensitively against the prompt text. No HTTP calls are made.

```python
from fastapi_startkit.ai import AgentResponse

agent = SupportAgent()
agent.fake({
    "*password*": AgentResponse(content="Click 'Forgot password' on the login page."),
    "*billing*":  AgentResponse(content="Contact billing@example.com."),
})

response = agent.prompt("How do I reset my password?")
assert response.content == "Click 'Forgot password' on the login page."
```

### AgentSnapshot — record & replay

`AgentSnapshot` calls the **real API on first run**, saves the response to a JSON file, and replays it from disk on every subsequent run. Tests are fast and deterministic after the first recording.

```python
from fastapi_startkit.ai import AgentSnapshot

agent = LeadAgent()
agent.fake({
    "*analyse*": AgentSnapshot(path="tests/fixtures/lead_analysis.json"),
})

response = agent.prompt("Analyse this lead: Jane Doe, Acme Corp")
# First run: calls the real API, saves tests/fixtures/lead_analysis.json
# Subsequent runs: loaded instantly from disk — no API call
```

The saved fixture is a plain JSON file you can inspect and commit:

```json
{
  "content": "Name: Jane Doe\nCompany: Acme Corp\nScore: 8",
  "tool_calls": [],
  "usage": { "input": 142, "output": 34 }
}
```

### Assertions

| Method | Description |
|---|---|
| `assert_prompted()` | Assert `prompt()` or `stream()` was called at least once |
| `assert_prompted(times=n)` | Assert exactly `n` calls |
| `assert_not_prompted()` | Assert neither method was ever called |
| `reset()` | Clear fakes and call log between test cases |

```python
def test_agent_is_called_once():
    agent = SupportAgent()
    agent.fake({"*": AgentResponse(content="OK")})

    agent.prompt("Hello")

    agent.assert_prompted(times=1)

def test_agent_is_not_called_in_cache_hit():
    agent = SupportAgent()
    agent.fake({"*": AgentResponse(content="cached")})

    serve_from_cache()   # hypothetical — doesn't call agent

    agent.assert_not_prompted()
```

### Resetting between tests

```python
def test_multiple_interactions():
    agent = SupportAgent()
    agent.fake({"*help*": AgentResponse(content="Here to help!")})

    agent.prompt("I need help.")
    agent.assert_prompted(times=1)

    agent.reset()   # clear log and fakes

    agent.assert_not_prompted()
```

---

## Provider Backends

Each backend is a thin wrapper over the official SDK.

### Anthropic

Uses the [`anthropic`](https://pypi.org/project/anthropic/) Python SDK. Tool calling and extended thinking are fully supported via `provider_options`.

```python
# Install
pip install anthropic

# Required env var
ANTHROPIC_API_KEY=sk-ant-...
```

### OpenAI

Uses the [`openai`](https://pypi.org/project/openai/) Python SDK. Note that tool execution in the agentic loop is currently single-step for the OpenAI backend (the Anthropic backend runs a full multi-step loop).

```python
# Install
pip install openai

# Required env var
OPENAI_API_KEY=sk-...
```

### Google Gemini

Uses the [`google-generativeai`](https://pypi.org/project/google-generativeai/) Python SDK.

```python
# Install
pip install google-generativeai

# Required env var (either works)
GEMINI_API_KEY=AIza...
GOOGLE_API_KEY=AIza...
```

> [!TIP]
> You can install all three SDKs at once with `pip install "fastapi-startkit[ai]"`.

---

## Complete Example

A sales agent with tools, document attachments, middleware, and a full test:

```python
# agents/sales_agent.py
from fastapi_startkit.ai import Agent, provider, model, max_tokens, max_steps

def lookup_crm(lead_id: str) -> str:
    """Look up a lead record in the CRM by ID."""
    # ... real CRM lookup
    return f"Lead {lead_id}: Jane Doe, Acme Corp, budget $50k"

def draft_email(to: str, subject: str) -> str:
    """Draft a follow-up email to a lead."""
    return f"Drafted email to {to} — Subject: {subject}"

@provider("anthropic")
@model("claude-sonnet-4-6")
@max_tokens(2048)
@max_steps(5)
class SalesAgent(Agent):
    def messages(self):
        return [
            {
                "role": "system",
                "content": (
                    "You are an expert sales assistant. "
                    "Use the available tools to research leads and draft follow-ups."
                ),
            }
        ]

    def tools(self):
        return [lookup_crm, draft_email]
```

```python
# tests/test_sales_agent.py
from fastapi_startkit.ai import AgentResponse
from agents.sales_agent import SalesAgent

def test_sales_agent_drafts_followup():
    agent = SalesAgent()
    agent.fake({
        "*lead*": AgentResponse(
            content="I've looked up lead L-99 and drafted a follow-up email.",
            tool_calls=[
                {"name": "lookup_crm",  "input": {"lead_id": "L-99"}},
                {"name": "draft_email", "input": {"to": "jane@acme.com", "subject": "Following up"}},
            ],
        )
    })

    response = agent.prompt("Research lead L-99 and draft a follow-up.")

    assert "follow-up" in response.content
    agent.assert_prompted(times=1)
```
