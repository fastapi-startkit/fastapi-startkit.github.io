---
outline: deep
title: Skills
description: Sync provider-declared AI skill documents to Claude Code and Gemini CLI using the ai:skills command.
keywords: AI skills, Claude Code, Gemini CLI, artisan, fastapi-startkit
---

# Skills

The `ai:skills` command copies the `SKILL.md` files that your registered providers declare into [Claude Code](https://claude.ai/code) and [Gemini CLI](https://github.com/google-gemini/gemini-cli), so those tools know how to work with the framework.

## Registration

Register `AISkillProvider` in your application:

```python
from fastapi_startkit import Application
from fastapi_startkit.skills import AISkillProvider

app = Application(providers=[..., AISkillProvider])
```

## Commands

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

| Target | Output |
|---|---|
| `claude` | `.claude/skills/<name>/SKILL.md` |
| `gemini` | `GEMINI.md` between `<!-- skills:start -->` and `<!-- skills:end -->` markers |

When a Claude skill file already exists, the command asks before overwriting it. Pass `--force` to overwrite without asking. The Gemini block between the markers is always rewritten.

## Built-in skills

The framework ships stubs for the `fastapi`, `database`, and `inertia` providers. A stub is only synced when its provider is registered. Running `--sync` copies them into `.ai/fastapi-startkit/` in your project first, then renders them to the AI agent files.

## SKILL.md format

Only `name` and `description` are read from the frontmatter:

```markdown
---
name: my-skill
description: One-line description.
---

Body content (markdown).
```

## Custom skills

To override a bundled stub, edit or create `.ai/fastapi-startkit/<key>/SKILL.md` in your project root, where `<key>` is `fastapi`, `database`, or `inertia`. The registry reads the project copy first and falls back to the bundled stub. Files under other keys are not picked up.
