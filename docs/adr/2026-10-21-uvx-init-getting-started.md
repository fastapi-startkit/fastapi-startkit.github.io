# Getting started leads with `uvx fastapi-startkit init`

Date: 2026-10-21

## Problem

Framework release 0.67.0 ships the `fastapi-startkit` console script with an interactive `init` command (framework PR #289), but the site still starts users with `pip install` / `uv add` and hand-written `bootstrap/application.py` and `artisan` files. The home page install pill shows `pip install fastapi-startkit`, and its three steps run `python artisan` commands without the project environment that `uv` creates.

## Alternatives

1. **Keep manual setup first and mention `init` at the end.** No restructuring, but new users still copy files by hand before seeing the installer.
2. **Replace the manual setup with the installer.** Shortest page, but drops the path for adding the framework to an existing project or using the single-file layout.
3. **Lead with the installer and keep manual setup as an alternative.** New projects get one command, and existing projects keep the full instructions.
4. **Lead with a hosted `curl | sh` script.** Saves installing uv separately, but only covers macOS and Linux, and the script was not hosted when this record was written (site PR #92).

## Decision

Option 3. `getting-started.md` gets a "Creating a Project" section right after the introduction: install uv, run `uvx fastapi-startkit init my-app`, answer the three questions, then `uv run python artisan serve`. An "Installer options" table lists every flag `init` accepts. The existing prerequisites, installation, simple and structured setups move under "Manual Setup" one heading level down. The hosted script from [2026-10-19](2026-10-19-install-script.md) is listed first in that section as the macOS/Linux one-liner, with `uvx` as the cross-platform path.

## Implementation

- Questions, choices, defaults, flags and the final output are copied from a real run of `uvx fastapi-startkit init` 0.67.0, not from memory.
- `uvx fastapi-startkit@latest init` is mentioned because `uvx` reuses its cached version.
- `InstallPill` defaults to `uvx fastapi-startkit init my-app`, so the hero and CTA both show the installer.
- `HomeSteps` becomes Create, Make a model, Migrate, with the artisan commands run through `uv run`.

## Validation

- In an empty directory, `uvx fastapi-startkit init my-app -n --app=web --database=sqlite --frontend=none` created the project and installed dependencies; `uv run python artisan serve` answered `/` and `/health`, `db:make:model Order` and `db:migrate` ran, and `uv run pytest` passed.
- An interactive run in a pseudo-terminal showed the three questions with the documented choices and defaults.
- `npm run docs:build` succeeds.
