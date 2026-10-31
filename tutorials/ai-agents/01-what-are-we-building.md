---
lesson: 1
title: What are we building?
description: Meet Job Assistant, the agent you'll build, and the few ideas the whole course rests on.
duration: 3
---

# What are we building?

**Goal:** know what you're going to build and the three ideas you'll use in every lesson.

## Job Assistant

By the end of this course you'll have a small API called Job Assistant. You send it a message and it replies like a helpful recruiter:

```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Any remote Python jobs?"}'
```

```json
{
  "reply": "Startup Inc is hiring a remote Python Developer.",
  "jobs": [
    {"title": "Python Developer", "company": "Startup Inc", "location": "Remote", "remote": true}
  ]
}
```

The model doesn't make those jobs up. It calls a search tool you write, and your code decides what goes back to the user.

## Three ideas

You only need three ideas to follow along.

**An agent is a class.** You describe an agent by extending `Agent` and overriding a few methods: what it's told to do (`instructions`), what it can use (`tools`) and what it remembers (`messages`).

```python
from fastapi_startkit.ai import Agent


class JobAssistant(Agent):
    def instructions(self) -> str:
        return "You are a friendly career assistant."
```

**A prompt returns a state.** `await agent.prompt("Hi")` returns a plain dict with a `messages` list, the same shape LangChain agents use. You read it with small helpers instead of digging through the list yourself:

```python
from fastapi_startkit.ai import state

result = await JobAssistant().prompt("Hi")
state.text(result)
```

**The provider is configuration.** The agent doesn't care which model runs it. This course uses Google Gemini because it has a free tier, but you can switch to OpenAI or Anthropic later by changing one environment variable.

## The plan

| Lesson | You'll add |
|---|---|
| 2 | A new project with the AI package installed |
| 3 | Your first agent behind a `/chat` endpoint |
| 4 | Streaming replies |
| 5 | A job search tool |
| 6 | A second agent that summarizes tool results |
| 7 | Structured output with a Pydantic model |
| 8 | Conversation memory |
| 9 | Middleware that logs every reply |
| 10 | Tests that run without an API key |
| 11 | Where to go next |

## Check

Nothing to run yet. If you know what `state.text(result)` gives you, you're ready for the next lesson.
