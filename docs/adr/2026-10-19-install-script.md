# Hosted install script

Date: 2026-10-19

## Problem

The framework's `fastapi-startkit init` wizard ([framework PR #289](https://github.com/fastapi-startkit/fastapi-startkit-framework/pull/289)) is started with `uvx fastapi-startkit init`, which assumes uv is already installed. The scaffolding FDR (`docs/fdr/001-project-scafolding.md` in the framework repo) asks for a one-line macOS/Linux bootstrap that works on a machine without uv:

```shell
/bin/bash -c "$(curl -fsSL https://HOST/install.sh)"
```

The script needs a project-controlled host, must install uv when it is missing, must make the new uv usable without restarting the terminal, and must keep the wizard's questions connected to the keyboard.

## Alternatives

1. **Host the script on this docs site.** VitePress copies `public/` to the site root, so `public/install.sh` is served at `https://fastapi-startkit.github.io/install.sh` by the existing GitHub Pages deploy. No new infrastructure, and the URL matches the project's domain.
2. **Serve it from `raw.githubusercontent.com` in the framework repo.** No deploy step, but the URL is long, tied to a branch name, and served as `text/plain` from a host the project does not brand.
3. **A dedicated domain or release asset.** Clean URL and versioned assets, but adds a domain or a release pipeline for one small file.

## Decision

Option 1. The script lives at `public/install.sh` and is published with the rest of the site.

The script runs `uv tool run fastapi-startkit@latest init`, forwarding its arguments. `@latest` makes uv check PyPI instead of reusing a cached older wizard, so the script does not need editing on every framework release. Users who need a fixed version set `FASTAPI_STARTKIT_VERSION`, which replaces `latest` in the requirement.

## Implementation

- `public/install.sh` is a bash script with `set -euo pipefail`, matching the documented `/bin/bash -c` invocation.
- Operating system: `Darwin` and `Linux` continue; anything else exits with a message pointing to `uvx fastapi-startkit init`.
- uv lookup: `command -v uv`, then the directories the official installer writes to (`$UV_INSTALL_DIR`, `$XDG_BIN_HOME`, `$HOME/.local/bin`, `$HOME/.cargo/bin`). A found binary is invoked by absolute path, and its directory is prepended to `PATH` so the wizard's own `uv sync` finds the same uv without a terminal restart.
- uv install: when no uv is found, the official installer (`https://astral.sh/uv/install.sh`) is downloaded with `curl` or `wget` and run with `sh`; the lookup then runs again and fails with a clear message if uv is still missing.
- Terminal input: when standard input is not a terminal (for example `curl … | bash`) and `/dev/tty` is readable, the wizard's input is redirected from `/dev/tty`, so the interactive questions still work.
- Arguments: everything passed to the script goes to `init`, so `curl -fsSL https://fastapi-startkit.github.io/install.sh | bash -s -- my-app` creates `my-app`.
- `docs/getting-started.md` lists the hosted script under "Creating a Project", next to `uvx fastapi-startkit init`, now that framework 0.67.0 ships `init`.

## Validation

- `bash -n public/install.sh` passes.
- With a stub `uv` on `PATH`, the script calls `uv tool run fastapi-startkit@latest init my-app --app web`, and `FASTAPI_STARTKIT_VERSION=0.67.0` turns the requirement into `fastapi-startkit@0.67.0`.
- With a temporary `HOME` and a `PATH` that has no uv, the script installs uv into the temporary `HOME` and runs it from there in the same process.
- With `PATH=/usr/bin:/bin` and uv only in `~/.local/bin`, `bash public/install.sh my-app --app web` creates the project and the wizard's `uv sync` succeeds.
- Piping the script into `bash` from a terminal still delivers keyboard input to the wizard.
- `npm run docs:build` copies the script to `.vitepress/dist/install.sh`.
