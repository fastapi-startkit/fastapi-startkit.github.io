---
lesson: 4
title: Streaming replies
description: Send the reply to the client piece by piece as the model writes it.
duration: 6
---

# Streaming replies

**Goal:** a `POST /chat/stream` endpoint that sends the reply as it's written, instead of making the user wait for the whole thing.

## How streaming works

`agent.stream(message)` is an async generator. It yields event dicts, the same shape LangChain's `astream_events` produces. The one you care about most is `on_chat_model_stream`: each one carries a small chunk of the reply.

```python
async for event in JobAssistant().stream("Hi"):
    if event["event"] == "on_chat_model_stream":
        print(event["data"]["chunk"].text)
```

## 1. Add a stream action

Add a `stream` method to `ChatController`. It wraps the events in a [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) response, one `data:` line per chunk.

```python
from fastapi.responses import StreamingResponse # [!code ++]
from fastapi_startkit.ai import state

from app.agents.job_assistant import JobAssistant
from app.http.requests.chat_request import ChatRequest


class ChatController:
    async def store(self, request: ChatRequest):
        result = await JobAssistant().prompt(request.message)

        return {"reply": state.text(result)}

    async def stream(self, request: ChatRequest): # [!code ++]
        async def generate(): # [!code ++]
            async for event in JobAssistant().stream(request.message): # [!code ++]
                if event["event"] == "on_chat_model_stream" and (text := event["data"]["chunk"].text): # [!code ++]
                    yield f"data: {text}\n\n" # [!code ++]
 # [!code ++]
        return StreamingResponse(generate(), media_type="text/event-stream") # [!code ++]
```

Empty chunks are skipped so the client never gets blank lines.

## 2. Add the route

```python
router.post("/chat", chat.store)
router.post("/chat/stream", chat.stream) # [!code ++]
```

## Check

Use `-N` so curl prints the chunks as they arrive instead of buffering them:

```bash
curl -N -X POST http://127.0.0.1:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Give me three tips for a job interview."}'
```

You'll see the reply come in a few words at a time:

```
data: Here are three

data:  quick tips:

data:  1. Research the company...
```

In a browser you'd read this with `fetch()` and a stream reader, appending each chunk to the page.
