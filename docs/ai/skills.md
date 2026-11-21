---
outline: deep
title: Skills
description: Sync the AI skill documents your providers declare to Claude Code and Gemini CLI with the ai:skills command.
keywords: AI skills, Claude Code, Gemini CLI, artisan, fastapi-startkit
---

# Skills

AI coding assistants write better code when they know the framework you're building on. The `ai:skills` command copies a `SKILL.md` file for each framework provider your application registers into [Claude Code](https://claude.ai/code) and [Gemini CLI](https://github.com/google-gemini/gemini-cli), so your assistant learns how to work with those parts of the framework.

## Registration

Add `AISkillProvider` to your application's providers. It registers the `ai:skills` command:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.skills import AISkillProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[FastAPIProvider, AISkillProvider],
)
```

## Commands

Run the command on its own to see which of your registered providers ship a skill:

```bash
uv run python artisan ai:skills
```

```text
Skill(s) found for the following provider(s):
1. fastapi
```

When you're ready to write the files, add `--sync`. Without `--target`, the command asks which assistant to publish for:

```bash
uv run python artisan ai:skills --sync --target=claude
```

```text
  Published .ai/fastapi-startkit/fastapi/SKILL.md
  Syncing 1 skill(s) to: claude…
  [claude] Published .claude/skills/fastapi-startkit/SKILL.md
```

The command accepts these options:

| Option | Short | Description |
|---|---|---|
| `--list` | `-l` | List providers that ship a skill. This is the default. |
| `--sync` | `-s` | Publish the skills and sync them to your assistants. |
| `--target=<agent>` | `-t` | `claude`, `gemini`, or `all`. You're prompted when it's omitted. |
| `--prune` | | Remove synced skills that no registered provider declares. |
| `--force` | `-f` | Overwrite existing files without asking. |

Passing `--target` or `--prune` also turns on `--sync`.

::: warning
With `--target=claude`, `--prune` deletes every directory under `.claude/skills/` that isn't a framework skill, including skills you wrote yourself.
:::

## Output Locations

Each target writes its skills to a different place:

| Target | Output |
|---|---|
| `claude` | `.claude/skills/<name>/SKILL.md`, where `<name>` is the skill's `name` |
| `gemini` | `GEMINI.md`, between `<!-- skills:start -->` and `<!-- skills:end -->` |

When a Claude skill file already exists, the command asks before it overwrites it. Pass `--force` to skip the question. In `GEMINI.md`, the block between the markers is always rewritten and the rest of the file is left alone. If the file has no markers yet, the block is appended to the end.

## Built-in Skills

The framework ships a skill for three providers. A skill is synced only when its provider is registered:

| Provider key | Provider |
|---|---|
| `fastapi` | `FastAPIProvider` |
| `database` | `DatabaseProvider` |
| `inertia` | `InertiaProvider` |

On `--sync`, each skill is first copied into `.ai/fastapi-startkit/<key>/SKILL.md` in your project, and then rendered to the assistant files. A copy that already exists in `.ai/` is kept unless you confirm the overwrite or pass `--force`.

<a id="skill-md-format"></a>

## Custom Skills

To change what your assistant is told, edit the project copy at `.ai/fastapi-startkit/<key>/SKILL.md` and run `--sync` again. The command reads your project copy first and falls back to the framework's version when there isn't one. Only the three keys above are read. Files under any other key are ignored.

A skill file is Markdown with a short frontmatter block:

```markdown
---
name: fastapi-startkit
description: Build routes, controllers and providers with FastAPI Startkit.
---

Use `Router` from `fastapi_startkit.fastapi` to define routes...
```

The `name` sets the Claude directory and the Gemini heading. When it's missing, the name of the file's directory is used. The `description` and the body are written to both assistants.
