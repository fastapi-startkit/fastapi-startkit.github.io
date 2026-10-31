---
lesson: 6
title: Turning tool results into a reply
description: Hand the raw tool output to a second, smaller agent that writes a friendly answer.
duration: 6
---

# Turning tool results into a reply

**Goal:** `/chat` returns a friendly sentence about the jobs it found, not just raw JSON.

## Why a second agent?

In the last lesson the turn ended with the tool's JSON. That's great for a UI that draws job cards, but people also want a sentence they can read. Since you're in control after the tool runs, you can pass its output to another agent whose only job is to summarize it.

Small agents with one job are easier to prompt, easier to test and easier to swap out later.

## 1. Write the summarizer

Create `app/agents/job_summarizer.py`:

```python
from fastapi_startkit.ai import Agent


class JobSummarizer(Agent):
    def instructions(self) -> str:
        return (
            "You get a JSON list of job openings. "
            "Write a short, friendly summary for the user: role, company and location. "
            "If the list is empty, say no jobs matched. Never invent jobs."
        )
```

It has no tools. It reads what you give it and writes a reply.

## 2. Chain the agents

When the tool ran, prompt the summarizer with the tool's output and return both the sentence and the jobs:

```python
import json

from fastapi.responses import StreamingResponse
from fastapi_startkit.ai import state

from app.agents.job_assistant import JobAssistant
from app.agents.job_summarizer import JobSummarizer # [!code ++]
from app.http.requests.chat_request import ChatRequest


class ChatController:
    async def store(self, request: ChatRequest):
        result = await JobAssistant().prompt(request.message)

        if tool_runs := state.tool_events(result):
            return {"jobs": json.loads(tool_runs[-1]["content"])} # [!code --]
            jobs = tool_runs[-1]["content"] # [!code ++]
            summary = await JobSummarizer().prompt(jobs) # [!code ++]
            return {"reply": state.text(summary), "jobs": json.loads(jobs)} # [!code ++]

        return {"reply": state.text(result)}
```

Now every response has a `reply`, and job searches also carry the `jobs` list for anything that wants to draw cards.

## Check

```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Any Python jobs?"}'
```

```json
{
  "reply": "Startup Inc is hiring a remote Python Developer.",
  "jobs": [
    {"title": "Python Developer", "company": "Startup Inc", "location": "Remote", "remote": true}
  ]
}
```

That's two model calls for one request: one to pick the tool arguments and one to write the summary. Keep that in mind when you think about cost and speed.
