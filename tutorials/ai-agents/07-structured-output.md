---
lesson: 7
title: Structured output
description: Turn a free-text introduction into a typed Pydantic object.
duration: 7
---

# Structured output

**Goal:** a `POST /profile` endpoint that reads a candidate's introduction and returns clean, typed fields.

## Text in, data out

Chat replies are great for people. Your code wants data it can trust: a list of skills, a yes or no for remote work. When an agent has a `schema()`, its reply is parsed into that model and you read it with `state.structured()`.

## 1. Write the agent and its schema

Create `app/agents/profile_extractor.py`:

```python
from pydantic import BaseModel

from fastapi_startkit.ai import Agent


class CandidateProfile(BaseModel):
    name: str
    title: str
    skills: list[str]
    location: str
    wants_remote: bool


class ProfileExtractor(Agent):
    def instructions(self) -> str:
        return (
            "Read the candidate's introduction and reply with ONLY a JSON object: "
            '{"name": str, "title": str, "skills": [str], "location": str, "wants_remote": bool}.'
        )

    def schema(self) -> type:
        return CandidateProfile
```

With a real model, FastAPI Startkit asks the provider for structured output using your schema. Spelling out the JSON shape in the instructions as well keeps the reply right when you run the agent with fakes in tests.

## 2. Add a request and a controller

Add a second request model to `app/http/requests/chat_request.py`:

```python
class ProfileRequest(BaseModel):
    text: str
```

Create `app/http/controllers/profile_controller.py`:

```python
from fastapi_startkit.ai import state

from app.agents.profile_extractor import ProfileExtractor
from app.http.requests.chat_request import ProfileRequest


class ProfileController:
    async def store(self, request: ProfileRequest):
        result = await ProfileExtractor().prompt(request.text)

        return state.structured(result).model_dump()
```

`state.structured(result)` gives you a `CandidateProfile` instance, so your editor knows every field.

## 3. Add the route

```python
from app.http.controllers.chat_controller import ChatController
from app.http.controllers.home_controller import HomeController
from app.http.controllers.profile_controller import ProfileController # [!code ++]
from fastapi_startkit.fastapi import Router

controller = HomeController()
chat = ChatController()
profile = ProfileController() # [!code ++]

router = Router()
router.get("/", controller.index, response_model=None)
router.get("/health", controller.health)
router.post("/chat", chat.store)
router.post("/chat/stream", chat.stream)
router.post("/profile", profile.store) # [!code ++]
```

## Check

```bash
curl -X POST http://127.0.0.1:8000/profile \
  -H "Content-Type: application/json" \
  -d '{"text": "Hi, I am Alex. I have been a Python developer in Lisbon for five years, mostly FastAPI. I would love to work remotely."}'
```

```json
{
  "name": "Alex",
  "title": "Python Developer",
  "skills": ["Python", "FastAPI"],
  "location": "Lisbon",
  "wants_remote": true
}
```

You could feed these fields straight into `search_jobs` to suggest jobs that match the profile.
