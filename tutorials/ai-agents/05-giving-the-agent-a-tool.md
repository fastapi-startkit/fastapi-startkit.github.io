---
lesson: 5
title: Giving the agent a tool
description: Write a search_jobs tool and let the agent decide when to call it.
duration: 10
---

# Giving the agent a tool

**Goal:** when someone asks for jobs, the agent calls your `search_jobs` tool and `/chat` returns the real matches.

## Why tools?

A model only knows what it was trained on. It has never seen your job board. A tool is a plain Python function the model is allowed to ask for. The model picks the arguments, your code runs the function, and the result comes from your data rather than the model's imagination.

## 1. Write the tool

Create `app/tools/search_jobs.py`. A real app would query a database. A short list is enough to learn with.

```python
import json

from langchain_core.tools import tool

JOBS = [
    {"title": "Python Developer", "company": "Startup Inc", "location": "Remote", "remote": True},
    {"title": "Backend Engineer", "company": "Acme Corp", "location": "Berlin", "remote": False},
    {"title": "Data Scientist", "company": "DataCo", "location": "New York", "remote": False},
    {"title": "DevOps Engineer", "company": "CloudBase", "location": "Remote", "remote": True},
    {"title": "Frontend Developer", "company": "Pixel Labs", "location": "London", "remote": False},
]


@tool
def search_jobs(keywords: str, remote: bool | None = None) -> str:
    """Search open jobs by keywords such as a role, a skill or a city.
    Set remote to true when the user only wants remote jobs."""
    words = keywords.lower().split()
    matches = [
        job for job in JOBS
        if any(word in f"{job['title']} {job['company']} {job['location']}".lower() for word in words)
    ]
    if remote is not None:
        matches = [job for job in matches if job["remote"] == remote]

    return json.dumps(matches)
```

The docstring and the type hints matter here. LangChain sends them to the model, which uses them to decide when to call the tool and how to fill in `keywords` and `remote`.

## 2. Give the tool to the agent

Return the tool from `tools()` and tell the agent when to use it:

```python
from langchain_core.tools import BaseTool # [!code ++]

from fastapi_startkit.ai import Agent

from app.tools.search_jobs import search_jobs # [!code ++]


class JobAssistant(Agent):
    def instructions(self) -> str:
        return (
            "You are a friendly career assistant. "
            "You help people find jobs. Keep your answers short. "
            "When the user asks for jobs, call the search_jobs tool." # [!code ++]
        )

    def tools(self) -> list[BaseTool]: # [!code ++]
        return [search_jobs] # [!code ++]
```

## 3. Read the tool result

Here's the one thing to know about tools in FastAPI Startkit: **when the model calls a tool, the turn ends with the tool's output.** The agent runs the tool once and hands you the result. It doesn't go back to the model for a second reply. You stay in control of what happens next.

`state.tool_events(result)` lists every tool that ran, with its `name`, `args` and `content`. Update the `store` action to return the jobs when the tool ran:

```python
import json # [!code ++]

from fastapi.responses import StreamingResponse
from fastapi_startkit.ai import state

from app.agents.job_assistant import JobAssistant
from app.http.requests.chat_request import ChatRequest


class ChatController:
    async def store(self, request: ChatRequest):
        result = await JobAssistant().prompt(request.message)

        if tool_runs := state.tool_events(result): # [!code ++]
            return {"jobs": json.loads(tool_runs[-1]["content"])} # [!code ++]
 # [!code ++]
        return {"reply": state.text(result)}
```

If the user just says hello, no tool runs and you get a normal reply.

## 4. Stream tool results too

While streaming, a tool run shows up as an `on_tool_start` event followed by an `on_tool_end` event. Send the output along so streaming clients see the jobs as well:

```python
async for event in JobAssistant().stream(request.message):
    if event["event"] == "on_chat_model_stream" and (text := event["data"]["chunk"].text):
        yield f"data: {text}\n\n"
    if event["event"] == "on_tool_end": # [!code ++]
        yield f"data: {event['data']['output'].content}\n\n" # [!code ++]
```

## Check

Restart the server and ask for remote jobs:

```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Any remote jobs?"}'
```

```json
{
  "jobs": [
    {"title": "Python Developer", "company": "Startup Inc", "location": "Remote", "remote": true},
    {"title": "DevOps Engineer", "company": "CloudBase", "location": "Remote", "remote": true}
  ]
}
```

The model chose the arguments, but every job came from your list. Ask for a plumber in Paris and you'll get an empty list instead of a made-up job.
