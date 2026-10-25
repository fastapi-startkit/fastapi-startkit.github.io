# Windows install script and a simpler "Creating a Project"

## Problem

"Creating a Project" offered macOS and Linux a single command ([2026-10-19](2026-10-19-install-script.md)), but Windows users had two steps: install uv with Astral's `install.ps1`, open a new terminal, then run `uvx fastapi-startkit init my-app`. The paragraph under the commands mixed argument passing, version pinning and a Windows caveat, and readers found it confusing. It also mentioned `FASTAPI_STARTKIT_VERSION=0.67.0` up front, which read as if users had to choose a version. Separately, the provider example at the top of the page listed `PluginProvider` and `TerminalProvider`, which don't exist, listed `AppProvider`, which is always registered, and had no imports.

Neither the framework's `init` command nor `install.sh` prompts for a version. The scripts default to `latest`, and the generated project's own version is written as `0.1.0`. The plain `uvx fastapi-startkit init` commands on the page and home screen could, however, reuse an older cached release.

## Alternatives

1. **Keep the two Windows steps and reword the text.** This leaves the extra terminal restart in place and Windows behind macOS and Linux.
2. **Ship `public/install.ps1` that mirrors `install.sh`.** One command on every platform, served from the same place.
3. **Ask Windows users to use WSL.** This adds a far bigger prerequisite than uv.

## Decision

Option 2, plus a rewrite of the page section and the provider example.

## Implementation

- `public/install.ps1` runs inside `& { ... } @args` so `irm | iex` does not leak variables into the user's session. It takes the version from `FASTAPI_STARTKIT_VERSION` or `latest`, finds uv on `PATH` or in `UV_INSTALL_DIR`, `XDG_BIN_HOME`, `~/.local/bin` or `~/.cargo/bin`, and installs it with Astral's `install.ps1` when it is missing. It then puts uv's directory on the session `PATH` and runs `uv tool run fastapi-startkit@<version> init` with the forwarded arguments. Errors use `throw` rather than `exit`, so a failure does not close the user's terminal, and the uv exit code is left in `$LASTEXITCODE`. Outside Windows it points to `install.sh` instead of installing uv.
- The Windows tab becomes `powershell -ExecutionPolicy ByPass -c "irm https://fastapi-startkit.github.io/install.ps1 | iex"`. Arguments use `& ([scriptblock]::Create((irm .../install.ps1))) my-app ...`.
- "Creating a Project": one command per platform, one sentence on what it does, then the questions table with "Where should the project be created?" as its first row. "Installer options" shows how to pass a directory and options on each platform. Version pinning is one optional sentence at the end.
- The Existing uv tab, home install pill and home steps use `uvx fastapi-startkit@latest init`, so a cached older release is never used silently.
- `install.sh` points Windows users to `install.ps1` and suggests `@latest` in its fallback message. Its behaviour is otherwise unchanged.
- The provider example is the `bootstrap/application.py` that `init` 0.67.0 generates for web + SQLite + React, with the framework's `FastAPIProvider`. The text names other real providers and says the configuration, event and application providers are always registered.

## Validation

- PowerShell 7.4.6 with a stub `uv` on `PATH`: `irm | iex` with no arguments runs `tool run fastapi-startkit@latest init`. A scriptblock call with `FASTAPI_STARTKIT_VERSION=0.66.0` and `'my app' --app=web` runs `fastapi-startkit@0.66.0 init`, with `my app` passed as one argument. The stub's exit code reaches `$LASTEXITCODE`, and no script variables leak.
- uv only in `UV_INSTALL_DIR` and not on `PATH`: it is found and used. With no uv on macOS, the script throws the `install.sh` pointer.
- With real uv, `install.ps1 <dir> -n --dry-run` runs the PyPI release and prints the plan.
- `install.sh` with a stub uv still runs `fastapi-startkit@latest init` and `FASTAPI_STARTKIT_VERSION` pins it, and `bash -n` passes.
- The provider example boots with `fastapi-startkit[database,fastapi,inertia,vite,sqlite]==0.67.0` in a generated project.
- `npm run docs:build` passes and copies `install.ps1` to the site root.
