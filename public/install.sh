#!/usr/bin/env bash
set -euo pipefail

version="${FASTAPI_STARTKIT_VERSION:-latest}"

fail() {
    printf 'fastapi-startkit: %s\n' "$1" >&2
    exit 1
}

download() {
    if command -v curl >/dev/null 2>&1; then
        curl -LsSf "$1"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "$1"
    else
        fail "curl or wget is required to install uv"
    fi
}

find_uv() {
    if command -v uv >/dev/null 2>&1; then
        command -v uv
        return 0
    fi
    local directory
    for directory in "${UV_INSTALL_DIR:-}" "${XDG_BIN_HOME:-}" "$HOME/.local/bin" "$HOME/.cargo/bin"; do
        if [ -n "$directory" ] && [ -x "$directory/uv" ]; then
            printf '%s\n' "$directory/uv"
            return 0
        fi
    done
    return 1
}

case "$(uname -s)" in
    Darwin | Linux) ;;
    *) fail "this installer supports macOS and Linux; with uv installed, run: uvx fastapi-startkit init" ;;
esac

if ! uv="$(find_uv)"; then
    printf 'Installing uv...\n'
    installer="$(download https://astral.sh/uv/install.sh)"
    sh -c "$installer"
    uv="$(find_uv)" || fail "uv was installed but could not be found; open a new terminal and run: uvx fastapi-startkit init"
fi

export PATH="$(dirname "$uv"):$PATH"

command=("$uv" tool run "fastapi-startkit@$version" init "$@")

if [ ! -t 0 ] && { : </dev/tty; } 2>/dev/null; then
    exec "${command[@]}" </dev/tty
fi
exec "${command[@]}"
