---
lesson: 9
title: Middleware
description: Wrap every model call to log how long it took and how many tokens it used.
duration: 6
---

# Middleware

**Goal:** every reply from `JobAssistant` writes a log line with its response time and token count.

## Code around every call

Middleware runs around the model call, a bit like HTTP middleware runs around a request. It's the right place for things every call needs: logging, timing, metrics, guardrails.

A middleware is a class with a `handle(model, handler)` method. Call `handler(model)` to continue, then use `.then(callback)` to run code once the model has answered. The callback gets the final message.

## 1. Write the middleware

Create `app/middleware/agent_logger.py`:

```python
import time
from collections.abc import Callable
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel

from fastapi_startkit.logging import Logger


class AgentLogger:
    def handle(self, model: BaseChatModel, handler: Callable) -> Any:
        started_at = time.monotonic()

        def log_response(final: Any) -> None:
            elapsed = time.monotonic() - started_at
            usage = getattr(final, "usage_metadata", None) or {}
            Logger.info(f"agent replied in {elapsed:.2f}s, {usage.get('output_tokens', '?')} output tokens")

        return handler(model).then(log_response)
```

## 2. Attach it to the agent

Return it from `middleware()`:

```python
from langchain_core.tools import BaseTool

from fastapi_startkit.ai import Agent, Middleware # [!code ++]

from app.middleware.agent_logger import AgentLogger # [!code ++]
from app.tools.search_jobs import search_jobs


class JobAssistant(Agent):
    ...

    def middleware(self) -> list[Middleware]: # [!code ++]
        return [AgentLogger()] # [!code ++]
```

Middleware runs for both `prompt()` and `stream()`, and the `.then()` callback fires once per call.

## Check

Restart the server, send a message to `/chat`, and look at the server's output or log file:

```
agent replied in 0.84s, 23 output tokens
```

Here's the finished agent:

```python
from langchain_core.tools import BaseTool

from fastapi_startkit.ai import Agent, Middleware

from app.middleware.agent_logger import AgentLogger
from app.tools.search_jobs import search_jobs


class JobAssistant(Agent):
    def __init__(self, history: list[dict] | None = None):
        self.history = history or []

    def instructions(self) -> str:
        return (
            "You are a friendly career assistant. "
            "You help people find jobs. Keep your answers short. "
            "When the user asks for jobs, call the search_jobs tool."
        )

    def messages(self) -> list[dict]:
        return self.history

    def tools(self) -> list[BaseTool]:
        return [search_jobs]

    def middleware(self) -> list[Middleware]:
        return [AgentLogger()]
```
