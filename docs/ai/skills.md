---
outline: deep
title: Skills
description: Sync provider-declared AI skill documents to Claude Code and Gemini CLI using the ai:skills command.
keywords: AI skills, Claude Code, Gemini CLI, artisan, fastapi-startkit
---

# Skills

::: warning Active development
The AI package is under active development. APIs may change without notice as we experiment with the best integration patterns. Use with caution in production.
:::

The Skills module syncs provider-declared `SKILL.md` documents to your local AI coding tools — [Claude Code](https://claude.ai/code) and [Gemini CLI](https://github.com/google-gemini/gemini-cli).

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

Existing files are skipped unless `--force` is passed.

## Built-in skills

The framework ships bundled stubs for the `fastapi` and `database` providers. Running `--sync` copies them into `.ai/fastapi-startkit/` in your project first, then renders them to the AI agent files.

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

To override a bundled stub or add a new skill, place a `SKILL.md` at `.ai/fastapi-startkit/<key>/SKILL.md` in your project root. The registry checks the project copy first and falls back to the bundled stub.
