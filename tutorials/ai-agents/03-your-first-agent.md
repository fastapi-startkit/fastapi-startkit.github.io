---
lesson: 3
title: Your first agent
description: Write the JobAssistant agent and put it behind a /chat endpoint.
duration: 8
---

# Your first agent

**Goal:** send a message to `POST /chat` and get the agent's reply back as JSON.

## 1. Write the agent

Create `app/agents/job_assistant.py`:

```python
from fastapi_startkit.ai import Agent


class JobAssistant(Agent):
    def instructions(self) -> str:
        return (
            "You are a friendly career assistant. "
            "You help people find jobs. Keep your answers short."
        )
```

That's a complete agent. `instructions()` becomes the system prompt. The provider and model come from your config, so Gemini's `gemini-2.5-flash-lite` runs it by default.

## 2. Describe the request

FastAPI validates the request body with a Pydantic model. Create `app/http/requests/chat_request.py`:

```python
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
```

## 3. Write the controller

Create `app/http/controllers/chat_controller.py`:

```python
from fastapi_startkit.ai import state

from app.agents.job_assistant import JobAssistant
from app.http.requests.chat_request import ChatRequest


class ChatController:
    async def store(self, request: ChatRequest):
        result = await JobAssistant().prompt(request.message)

        return {"reply": state.text(result)}
```

`prompt()` returns the whole turn as `{"messages": [...]}`. `state.text()` picks out the text of the last message, which is the agent's reply.

## 4. Add the route

Open `routes/api.py` and register the controller:

```python
from app.http.controllers.chat_controller import ChatController # [!code ++]
from app.http.controllers.home_controller import HomeController
from fastapi_startkit.fastapi import Router

controller = HomeController()
chat = ChatController() # [!code ++]

router = Router()
router.get("/", controller.index, response_model=None)
router.get("/health", controller.health)
router.post("/chat", chat.store) # [!code ++]
```

## Check

Start the server with `uv run python artisan serve` and send a message:

```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hi, what can you do?"}'
```

You'll get something like this. The exact words change every time, because it's a real model talking.

```json
{"reply": "Hi! I can help you find your next job. What kind of role are you looking for?"}
```

::: warning API key required
If `GEMINI_API_KEY` is empty, the request fails with this error:

```
API key required for Gemini Developer API. Provide api_key parameter or set GOOGLE_API_KEY/GEMINI_API_KEY
```

Add your key to `.env` and restart the server. If you'd rather not use a key at all, skip ahead to [lesson 10](./10-testing-your-agent) to see how to run the agent with fake replies, then come back.
:::

Try sending an empty body too. FastAPI rejects it before the agent runs, so a bad request never costs you a model call.
