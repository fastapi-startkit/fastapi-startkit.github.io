---
lesson: 11
title: What's next?
description: Recap what you built and pick where to go from here.
duration: 3
---

# What's next?

**Goal:** know what you've built and where to take it next.

## What you built

Job Assistant now:

- answers on `/chat` and streams on `/chat/stream`,
- searches your jobs with a tool and never invents one,
- hands tool results to a second agent for a friendly summary,
- turns an introduction into a typed `CandidateProfile`,
- remembers each conversation by `thread_id`,
- logs the time and token count of every reply,
- and has tests that run offline.

That's the core of most real agents. Everything else builds on the same pieces: an `Agent` class, `prompt()` or `stream()`, and the `state` helpers.

## Ideas to try

- **Switch providers.** Set `AI_PROVIDER=openai` or `AI_PROVIDER=anthropic`, install the matching LangChain package and add its key. Your agents don't change.
- **Use a database.** Move `JOBS` into a model and the conversations into a table so they survive a restart. The [database docs](/docs/database/) show you how.
- **Match jobs to profiles.** Pass the fields from `/profile` into `search_jobs` to suggest jobs for a candidate.
- **Read CVs.** Attach a PDF as a `Document` with `prompt(..., attachments=[...])`. See [documents](/docs/ai/agent#documents).

## Keep reading

- [AI Agents](/docs/ai/agent) covers every option on `Agent`, including decorators, provider options and the full list of test assertions.
- [MCP](/docs/ai/mcp) shows how to build MCP servers with tools, prompts and resources.
- [Skills](/docs/ai/skills) syncs the skill documents your providers declare to coding assistants.
- [Images](/docs/ai/image) and [Audio](/docs/ai/audio) generate pictures and speech.
