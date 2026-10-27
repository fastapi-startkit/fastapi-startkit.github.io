---
course: true
title: Build an AI Agent
description: Build a job-search assistant that chats, streams, calls tools, returns structured data, remembers conversations and is fully tested without an API key.
level: Beginner
order: 1
aside: false
---

# Build an AI Agent

In this course you'll build **Job Assistant**, a small API that helps people find work. You'll start with an empty project and finish with an agent that:

- answers questions over a `/chat` endpoint,
- streams its reply word by word,
- searches a list of jobs with a tool,
- turns a candidate's introduction into structured data,
- remembers what was said earlier in a conversation,
- logs how long each reply took,
- and has a test suite that runs offline, with no API key.

Every lesson builds on the one before it, so work through them in order. Each one ends with a quick check, so you always know your code works before you move on.

## What you need

- Python 3.12 or newer
- [uv](https://docs.astral.sh/uv/), to create the project and run commands
- A free [Google Gemini API key](https://aistudio.google.com/apikey) if you want to talk to a real model. The tests in this course don't need one.
