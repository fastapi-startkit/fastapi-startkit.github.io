---
lesson: 8
title: Remembering the conversation
description: Pass earlier messages to the agent so it can follow a conversation.
duration: 8
---

# Remembering the conversation

**Goal:** tell the agent your name in one request and have it remember in the next.

## Agents forget by default

Every `prompt()` starts fresh. Try it: say "I'm Alex", then ask "What's my name?" and the agent has no idea. To hold a conversation, you keep the earlier messages yourself and give them back to the agent each time.

The `messages()` method does that. Whatever it returns is sent between the instructions and the new message, in this order:

```
system  →  earlier user and assistant messages  →  the new user message
```

## 1. Store the conversation

A real app would save messages in a database or Redis. A dict in memory is enough to see the idea. Create `app/repositories/conversations.py`:

```python
from collections import defaultdict

threads: dict[str, list[dict]] = defaultdict(list)


def history(thread_id: str) -> list[dict]:
    return list(threads[thread_id])


def remember(thread_id: str, message: str, reply: str) -> None:
    threads[thread_id].append({"role": "user", "content": message})
    threads[thread_id].append({"role": "assistant", "content": reply})
```

Each conversation gets its own `thread_id`, so two users never see each other's messages.

## 2. Give the agent its history

Let `JobAssistant` take a history and return it from `messages()`:

```python
class JobAssistant(Agent):
    def __init__(self, history: list[dict] | None = None): # [!code ++]
        self.history = history or [] # [!code ++]

    def instructions(self) -> str:
        ...

    def messages(self) -> list[dict]: # [!code ++]
        return self.history # [!code ++]

    def tools(self) -> list[BaseTool]:
        return [search_jobs]
```

## 3. Send a thread id

Add a `thread_id` to the request. It has a default, so old clients keep working:

```python
class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default" # [!code ++]
```

## 4. Load and save in the controller

Load the history before prompting, and save both sides of the exchange after:

```python
from app.repositories import conversations # [!code ++]


class ChatController:
    async def store(self, request: ChatRequest):
        agent = JobAssistant(history=conversations.history(request.thread_id)) # [!code ++]
        result = await agent.prompt(request.message) # [!code ++]

        if tool_runs := state.tool_events(result):
            jobs = tool_runs[-1]["content"]
            summary = await JobSummarizer().prompt(jobs)
            reply = state.text(summary) # [!code ++]
            conversations.remember(request.thread_id, request.message, reply) # [!code ++]
            return {"reply": reply, "jobs": json.loads(jobs)}

        reply = state.text(result) # [!code ++]
        conversations.remember(request.thread_id, request.message, reply) # [!code ++]
        return {"reply": reply}
```

You save the summary rather than the raw JSON, so the history reads like a normal chat.

## Check

Send two messages on the same thread:

```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hi, I am Alex.", "thread_id": "alex"}'

curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is my name?", "thread_id": "alex"}'
```

```json
{"reply": "Your name is Alex."}
```

Ask the same question with a different `thread_id` and the agent won't know. The memory lives in the process, so it's gone when you restart the server.
