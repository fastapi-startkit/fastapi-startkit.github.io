---
outline: deep
title: Skills
description: Sync provider-declared AI skills to Claude Code and Gemini CLI — incremental, idempotent, and driven by the providers already registered in your application.
keywords: AI skills, Claude Code, Gemini CLI, skills:sync, skills:list, artisan, fastapi-startkit, provider, agent
---

# Skills

FastAPI Startkit's **Skills** module lets your registered service providers declare reusable AI skill documents that are automatically synced to your local AI coding tools — [Claude Code](https://claude.ai/code) and [Gemini CLI](https://github.com/google-gemini/gemini-cli). Once synced, those tools have structured, always-up-to-date context about the framework features available in your project.

---

## Concept

Skills are plain Markdown files (`SKILL.md`) co-located with each provider. When you run `artisan skills:sync`, the framework:

1. Scans only the providers **registered in your application** — not the whole package.
2. Reads the `SKILL.md` from each provider's `skills/` directory.
3. Writes the skill into each target agent's expected format — idempotently.

This means the skills that get synced are always the right subset for your project. A project using only `FastAPIProvider` and `DatabaseProvider` only gets the FastAPI and ORM skills; broadcasting skills stay out until you add `ReverbProvider`.

```
Your application
├── bootstrap/application.py        (registered providers)
│
└── fastapi_startkit/
    ├── fastapi/providers/
    │   └── skills/
    │       └── SKILL.md            ← FastAPI skill
    ├── masoniteorm/providers/
    │   └── skills/
    │       └── SKILL.md            ← ORM skill
    └── console/providers/
        └── skills/
            └── SKILL.md            ← Console skill
                                             │
                                             ▼
                            artisan skills:sync
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     ▼                                               ▼
          .claude/skills/<name>/SKILL.md                        GEMINI.md
          (Claude Code format)                          (marker-delimited sections)
```

---

## Installation

Skills are part of the core package — no extra dependencies needed. Register `SkillsServiceProvider` in your application:

```python
# bootstrap/application.py
from fastapi_startkit import Application
from fastapi_startkit.skills import SkillsServiceProvider

app = Application(
    base_path=...,
    providers=[
        # ... other providers
        SkillsServiceProvider,
    ]
)
```

If you want to install the package with the `[skills]` extra to ensure all optional skill-sync dependencies are present:

```bash
pip install "fastapi-startkit[skills]"
# or with uv
uv add "fastapi-startkit[skills]"
```

---

## Usage

### Sync skills to your AI tools

```bash
artisan skills:sync
```

Scans all registered providers, collects their `SKILL.md` files, and writes them to every configured target.

#### Sync to a specific target

```bash
artisan skills:sync --target claude     # Claude Code only
artisan skills:sync --target gemini     # Gemini CLI only
artisan skills:sync --target all        # Both (default)
```

#### Remove stale skills

```bash
artisan skills:sync --prune
```

When `--prune` is passed, any skill previously synced from a provider that is **no longer registered** in the application is removed from the target. Use this after removing a provider to keep your agent context clean.

---

### List available skills

```bash
artisan skills:list
```

Shows every skill discovered from the currently-registered providers, its source path, and whether it has been synced to each target.

Example output:

```
+------------------+--------------------------------------------+---------+---------+
| Skill            | Source                                     | Claude  | Gemini  |
+------------------+--------------------------------------------+---------+---------+
| fastapi          | fastapi/providers/skills/SKILL.md          | ✓       | ✓       |
| orm              | masoniteorm/providers/skills/SKILL.md      | ✓       | ✓       |
| console          | console/providers/skills/SKILL.md          | ✓       | –       |
+------------------+--------------------------------------------+---------+---------+
```

---

## Supported Targets

| Target | Flag | Output path | Format |
|--------|------|-------------|--------|
| **Claude Code** | `--target claude` | `.claude/skills/<name>/SKILL.md` | YAML frontmatter + Markdown body |
| **Gemini CLI** | `--target gemini` | `GEMINI.md` | Marker-delimited sections |

### Claude Code

Each skill becomes a standalone file under `.claude/skills/<name>/SKILL.md`:

```
.claude/
└── skills/
    ├── fastapi/
    │   └── SKILL.md
    ├── orm/
    │   └── SKILL.md
    └── console/
        └── SKILL.md
```

The file uses YAML frontmatter to declare the skill's identity:

```markdown
---
name: fastapi
description: FastAPI routing, resource controllers, and request handling in FastAPI Startkit.
---

# FastAPI Skill

Use this skill when working with routes, controllers, middleware, or the FastAPI instance.
...
```

Writes are **idempotent** — the adapter only touches files it owns. If you have custom content in `.claude/skills/`, it is never touched unless it was previously written by the adapter.

### Gemini CLI

Gemini CLI uses a single `GEMINI.md` file in the project root. The adapter writes each skill into a **named marker section**:

```markdown
<!-- skills:fastapi:start -->
# FastAPI Skill
...
<!-- skills:fastapi:end -->

<!-- skills:orm:start -->
# ORM Skill
...
<!-- skills:orm:end -->
```

Everything outside the `<!-- skills:*:start -->` / `<!-- skills:*:end -->` markers is left untouched. Running `skills:sync` again updates only what changed; `--prune` removes the marker block for any de-registered skill.

---

## Authoring Your Own Skill

To expose a skill from your own provider, add a `skills/` directory next to your `provider.py` and create a `SKILL.md` file inside it:

```
my_package/
├── providers/
│   ├── my_provider.py
│   └── skills/
│       └── SKILL.md
```

### SKILL.md frontmatter

The frontmatter block at the top of `SKILL.md` is required:

```yaml
---
name: my-feature              # unique kebab-case identifier
description: >                # one-line summary shown in skills:list
  What this skill covers — shown in tools and skill:list output.
version: 1                    # optional; increment to force re-sync
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique kebab-case identifier. Used as the `.claude/skills/<name>/` directory name and the Gemini marker key. |
| `description` | Yes | One-sentence summary. Shown in `skills:list` output and in Claude Code's skill picker. |
| `version` | No | Increment to force a re-sync even when the content has not changed. Useful during development. |

### SKILL.md body

The body is plain Markdown. Write it for an AI coding assistant — be specific, include examples, and describe *when* to use the skill:

```markdown
---
name: payments
description: Stripe payment integration — charge, refund, and webhook handling.
---

# Payments Skill

Use this skill when the user asks about processing payments, handling Stripe webhooks,
or managing subscriptions.

## Charging a card

```python
from app.services.payment_service import PaymentService

charge = await PaymentService.charge(amount=2000, currency="usd", customer_id=customer.stripe_id)
```

## Handling webhooks

Register the webhook route in `routes/api.py` and verify the signature using `PaymentService.verify_webhook(request)`.
```

### Registering your provider

For the skill to be discovered, the provider must be registered in the application. The `SkillsServiceProvider` walks `app.providers` at sync time — it only sees what is registered:

```python
# bootstrap/application.py
app = Application(
    providers=[
        MyProvider,         # ← skill at my_package/providers/skills/SKILL.md is discovered
        SkillsServiceProvider,
    ]
)
```

---

## Design Rationale

### Why provider-driven discovery?

Tying skill discovery to the registered providers means the skills you sync are exactly the skills that apply to your project. There is no manual list to maintain — add a provider, get its skills; remove it, `--prune` removes its skills.

### Why two adapters?

Claude Code and Gemini CLI have fundamentally different context models:

- **Claude Code** stores skills as individual files under `.claude/skills/`. Each file is standalone and has YAML frontmatter for metadata.
- **Gemini CLI** reads a single `GEMINI.md` project context file. Skills are injected as named marker sections so they coexist with your own hand-written context.

The adapter layer abstracts this difference. Adding a new target (e.g., Codex, Cursor) means writing one new adapter class — the registry, commands, and skill files stay unchanged.

### Idempotency and marker-based writes

Every write is safe to re-run. The Claude adapter checks the existing file content before writing; the Gemini adapter only touches text between its own `<!-- skills:*:start -->` / `<!-- skills:*:end -->` markers. This means:

- Running `skills:sync` twice has no side effects.
- User-authored content is never overwritten.
- CI pipelines can verify skills are up-to-date with `skills:sync --dry-run` (v2 roadmap).
