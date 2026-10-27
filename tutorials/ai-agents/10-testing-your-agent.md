---
lesson: 10
title: Testing your agent
description: Test every endpoint offline with fake replies, fake tool calls and recorded cassettes.
duration: 12
---

# Testing your agent

**Goal:** a test suite that covers chat, streaming, tools, structured output and memory, and runs in under a second with no API key.

## Why fakes?

Real model calls are slow, cost money and give different words every time. That's fine in production and terrible in a test. `Agent.fake()` swaps the model for a list of replies you choose, so the rest of your code runs for real: the controller, the tool, the history and the middleware.

## 1. Set up the test case

Every test needs the app booted. Put that in a shared base class, `tests/test_case.py`, so each test file stays short:

```python
from fastapi_startkit.fastapi.testing import HttpTestCase


class TestCase(HttpTestCase):
    def get_application(self):
        from bootstrap.application import app

        return app
```

## 2. Fake a reply

Create `tests/test_chat.py`. `@JobAssistant.fake([...])` makes every `JobAssistant` in the test answer with the replies in the list, in order.

```python
from langchain_core.messages import AIMessage

from app.agents.job_assistant import JobAssistant
from app.agents.job_summarizer import JobSummarizer
from app.agents.profile_extractor import ProfileExtractor
from app.repositories import conversations
from tests.test_case import TestCase


class TestChat(TestCase):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        conversations.threads.clear()

    @JobAssistant.fake(["Hi! I can help you find your next job."])
    async def test_it_replies(self):
        response = await self.post("/chat", json={"message": "Hi, what can you do?"})

        response.assert_ok()
        response.assert_json(exact={"reply": "Hi! I can help you find your next job."})
```

`asyncSetUp` clears the in-memory conversations so tests don't leak into each other.

## 3. Fake a stream

The same fake works for `stream()`:

```python
    @JobAssistant.fake(["Hello there!"])
    async def test_it_streams_the_reply(self):
        response = await self.post("/chat/stream", json={"message": "Hi"})

        response.assert_ok()
        response.assert_stream_contains("Hello there!")
```

## 4. Fake a tool call

A reply doesn't have to be text. Pass an `AIMessage` with `tool_calls` and the agent runs your **real** `search_jobs` tool with those arguments. Stack a second fake for the summarizer:

```python
    @JobAssistant.fake([
        AIMessage(content="", tool_calls=[{"name": "search_jobs", "args": {"keywords": "python"}, "id": "call_1"}]),
    ])
    @JobSummarizer.fake(["Startup Inc is hiring a remote Python Developer."])
    async def test_it_searches_for_jobs(self):
        response = await self.post("/chat", json={"message": "Any Python jobs?"})

        response.assert_ok()
        assert response.json()["reply"] == "Startup Inc is hiring a remote Python Developer."
        assert response.json()["jobs"][0]["company"] == "Startup Inc"
```

The jobs in the response come from your tool, so this test catches bugs in the search code too.

## 5. Fake structured output

For an agent with a schema, fake the JSON text. It's parsed into your Pydantic model just like a real reply:

```python
    @ProfileExtractor.fake([
        '{"name": "Alex", "title": "Python Developer", "skills": ["Python", "FastAPI"], '
        '"location": "Lisbon", "wants_remote": true}'
    ])
    async def test_it_extracts_a_profile(self):
        response = await self.post("/profile", json={"text": "I'm Alex, a Python developer in Lisbon..."})

        response.assert_ok()
        assert response.json()["skills"] == ["Python", "FastAPI"]
        assert response.json()["wants_remote"] is True
```

## 6. Test the memory

`fake()` also works as a context manager. Two replies cover two requests:

```python
    async def test_it_remembers_the_conversation(self):
        with JobAssistant.fake(["Nice to meet you, Alex!", "Your name is Alex."]):
            await self.post("/chat", json={"message": "I'm Alex.", "thread_id": "alex"})
            response = await self.post("/chat", json={"message": "What's my name?", "thread_id": "alex"})

        response.assert_json(exact={"reply": "Your name is Alex."})
        assert len(conversations.history("alex")) == 4
```

## 7. Record a real reply once

Sometimes you want a test against what the real model said. `Agent.record()` saves the conversation to a cassette file the first time and replays it from the file every time after that. Run it once with your API key, commit the file, and the test runs offline from then on.

```python
from app.agents.job_assistant import JobAssistant
from tests.test_case import TestCase


class TestRecorded(TestCase):
    async def test_it_says_hello(self):
        with JobAssistant.record("cassettes/hello.json") as agent:
            await agent.prompt("Hello")

            agent.assert_prompted(times=1)
            agent.assert_text_response()
            agent.assert_tool_not_called(["search_jobs"])
```

The path is relative to the test file, so this cassette lands in `tests/cassettes/hello.json`. Delete the file to record a fresh one.

## Check

```bash
uv run pytest -v
```

```
tests/test_application.py::TestApplication::test_health PASSED
tests/test_chat.py::TestChat::test_it_extracts_a_profile PASSED
tests/test_chat.py::TestChat::test_it_remembers_the_conversation PASSED
tests/test_chat.py::TestChat::test_it_replies PASSED
tests/test_chat.py::TestChat::test_it_searches_for_jobs PASSED
tests/test_chat.py::TestChat::test_it_streams_the_reply PASSED
```

All green, no key needed. The recorded test is the one exception: run it once with your key to create the cassette, and it runs offline after that.
