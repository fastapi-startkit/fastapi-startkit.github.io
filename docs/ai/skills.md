---
outline: deep
title: Skills
description: Sync the AI skill documents your providers declare to Claude Code and Gemini CLI with the ai:skills command.
keywords: AI skills, Claude Code, Gemini CLI, artisan, fastapi-startkit
---

# Skills

AI coding assistants do their best work when they understand the framework you're building on. FastAPI Startkit helps with that through the `ai:skills` command, which copies the `SKILL.md` files your registered providers declare into [Claude Code](https://claude.ai/code) and [Gemini CLI](https://github.com/google-gemini/gemini-cli). Once synced, those tools know how to work with the framework.

## Registration

To get started, register `AISkillProvider` in your application:

```python
from fastapi_startkit import Application
from fastapi_startkit.skills import AISkillProvider

app = Application(providers=[..., AISkillProvider])
```

## Commands

Running the command on its own lists the providers that declare skills. Add `--sync` when you're ready to write them out:

```bash
# List providers that declare skills (default)
artisan ai:skills

# Publish stubs and sync to AI agents
artisan ai:skills --sync
```

| Flag | Short | Description |
|---|---|---|
| `--list` | `-l` | List providers with skills |
| `--sync` | `-s` | Publish stubs and sync to AI agents |
| `--target=<agent>` | `-t` | `claude`, `gemini`, or `all` (prompted if omitted) |
| `--prune` | | Remove skill files no longer declared by any provider |
| `--force` | `-f` | Overwrite existing files without prompting |

## Output locations

Each target writes its skills to a different place:

| Target | Output |
|---|---|
| `claude` | `.claude/skills/<name>/SKILL.md` |
| `gemini` | `GEMINI.md` between `<!-- skills:start -->` and `<!-- skills:end -->` markers |

When a Claude skill file already exists, the command asks before overwriting it; pass `--force` if you'd like to skip the prompt. The Gemini block between the markers, on the other hand, is always rewritten.

## Built-in skills

The framework ships stubs for the `fastapi`, `database`, and `inertia` providers, and a stub is only synced when its provider is registered. When you run `--sync`, the stubs are first copied into `.ai/fastapi-startkit/` in your project, then rendered to the AI agent files.

## SKILL.md format

A skill file is ordinary Markdown with a small frontmatter block. Only `name` and `description` are read from it:

```markdown
---
name: my-skill
description: One-line description.
---

Body content (markdown).
```

## Custom skills

If a bundled stub doesn't quite fit your project, you can override it. Edit or create `.ai/fastapi-startkit/<key>/SKILL.md` in your project root, where `<key>` is `fastapi`, `database`, or `inertia`. The registry reads your project copy first and falls back to the bundled stub. Files under any other key are not picked up.
