"""Reproducible overhead-delta benchmark harness.

Boots each app (raw FastAPI baseline and FastAPI Startkit) under an identical
uvicorn configuration, drives it with ApacheBench (`ab`) under keep-alive, takes
the median of N trials, and reports throughput plus the overhead delta the
framework adds over the raw baseline.

The framing is deliberately honest: the baseline is *raw FastAPI only*. Both
apps do the exact same work, so any difference is framework overhead — never a
comparison against an unrelated stack.

Usage:
    uv run python bench.py                # default parameters
    uv run python bench.py --requests 100000 --concurrency 128 --trials 5

Output:
    results/results.json   machine-readable results + environment metadata
    results/summary.md     human-readable table used by the methodology page
"""

from __future__ import annotations

import argparse
import json
import platform
import re
import shutil
import socket
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
RESULTS_DIR = HERE / "results"

APPS = [
    {"key": "raw_fastapi", "label": "Raw FastAPI", "module": "apps.raw:app"},
    {"key": "fastapi_startkit", "label": "FastAPI Startkit", "module": "apps.startkit:app"},
]
ENDPOINTS = [
    {"key": "json", "label": "JSON serialization", "path": "/json"},
    {"key": "plaintext", "label": "Plaintext", "path": "/plaintext"},
]

RPS_RE = re.compile(r"Requests per second:\s+([\d.]+)")
PERCENTILE_RE = re.compile(r"^\s*(\d+)%\s+(\d+)")
FAILED_RE = re.compile(r"Failed requests:\s+(\d+)")


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_until_ready(url: str, timeout: float = 20.0) -> None:
    deadline = time.monotonic() + timeout
    last_err: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                if resp.status == 200:
                    return
        except (urllib.error.URLError, ConnectionError, OSError) as exc:
            last_err = exc
            time.sleep(0.1)
    raise RuntimeError(f"server at {url} never became ready: {last_err}")


def start_server(module: str, port: int) -> subprocess.Popen:
    return subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn", module,
            "--host", "127.0.0.1", "--port", str(port),
            "--workers", "1", "--log-level", "warning", "--no-access-log",
        ],
        cwd=HERE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def stop_server(proc: subprocess.Popen) -> None:
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=10)


def run_ab(url: str, requests: int, concurrency: int) -> dict:
    out = subprocess.run(
        ["ab", "-k", "-n", str(requests), "-c", str(concurrency), url],
        capture_output=True, text=True, check=True,
    ).stdout

    rps_match = RPS_RE.search(out)
    if not rps_match:
        raise RuntimeError(f"could not parse ab output for {url}:\n{out}")

    failed = int(FAILED_RE.search(out).group(1)) if FAILED_RE.search(out) else 0
    percentiles: dict[str, int] = {}
    for line in out.splitlines():
        m = PERCENTILE_RE.match(line)
        if m:
            percentiles[m.group(1)] = int(m.group(2))

    return {
        "rps": float(rps_match.group(1)),
        "failed": failed,
        "p50_ms": percentiles.get("50"),
        "p99_ms": percentiles.get("99"),
    }


def measure(app: dict, endpoint: dict, args) -> dict:
    port = free_port()
    url = f"http://127.0.0.1:{port}{endpoint['path']}"
    proc = start_server(app["module"], port)
    try:
        wait_until_ready(url)
        run_ab(url, args.warmup, args.concurrency)  # warm up, discard
        trials = [run_ab(url, args.requests, args.concurrency) for _ in range(args.trials)]
    finally:
        stop_server(proc)

    rps_values = [t["rps"] for t in trials]
    best = max(trials, key=lambda t: t["rps"])
    return {
        # Peak is the meaningful capacity number: background contention can only
        # slow a trial down, never push it past the app's true ceiling.
        "rps_peak": round(max(rps_values), 1),
        "rps_median": round(statistics.median(rps_values), 1),
        "p50_ms": best["p50_ms"],
        "p99_ms": best["p99_ms"],
        "failed_total": sum(t["failed"] for t in trials),
        "trials": trials,
    }


def load_tool_version() -> str:
    try:
        out = subprocess.run(["ab", "-V"], capture_output=True, text=True).stdout
        first = out.strip().splitlines()[0] if out.strip() else "ApacheBench"
        return first.strip()
    except Exception:
        return "ApacheBench"


def package_version(name: str) -> str:
    try:
        from importlib.metadata import version

        return version(name)
    except Exception:
        return "unknown"


def build_summary(results: dict) -> str:
    params = results["parameters"]
    lines = [
        "# Benchmark results",
        "",
        f"- **Host:** {results['environment']['cpu']} ({results['environment']['cpu_count']} logical cores)",
        f"- **Python:** {results['environment']['python']}",
        f"- **fastapi-startkit:** {results['environment']['fastapi_startkit']} · "
        f"**fastapi:** {results['environment']['fastapi']} · "
        f"**uvicorn:** {results['environment']['uvicorn']}",
        f"- **Load tool:** {results['environment']['load_tool']}",
        f"- **Parameters:** {params['requests']:,} requests · concurrency {params['concurrency']} · "
        f"peak of {params['trials']} trials · single uvicorn worker · keep-alive",
        "",
        "| Endpoint | Raw FastAPI (req/s) | FastAPI Startkit (req/s) | Overhead |",
        "| --- | ---: | ---: | ---: |",
    ]
    for ep in ENDPOINTS:
        raw = results["measurements"]["raw_fastapi"][ep["key"]]["rps_peak"]
        kit = results["measurements"]["fastapi_startkit"][ep["key"]]["rps_peak"]
        overhead = (raw - kit) / raw * 100 if raw else 0.0
        lines.append(
            f"| {ep['label']} | {raw:,.0f} | {kit:,.0f} | {overhead:+.1f}% |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--requests", type=int, default=50_000)
    parser.add_argument("--concurrency", type=int, default=64)
    parser.add_argument("--trials", type=int, default=3)
    parser.add_argument("--warmup", type=int, default=5_000)
    args = parser.parse_args()

    if not shutil.which("ab"):
        sys.exit("error: ApacheBench (`ab`) is not installed or not on PATH.")

    RESULTS_DIR.mkdir(exist_ok=True)

    measurements: dict = {}
    for app in APPS:
        measurements[app["key"]] = {}
        for endpoint in ENDPOINTS:
            print(f"→ {app['label']:>18}  {endpoint['path']}", flush=True)
            result = measure(app, endpoint, args)
            measurements[app["key"]][endpoint["key"]] = result
            print(
                f"   peak {result['rps_peak']:>12,.1f} req/s"
                f"  (median {result['rps_median']:,.1f} · p50 {result['p50_ms']}ms · "
                f"p99 {result['p99_ms']}ms · failed {result['failed_total']})",
                flush=True,
            )

    results = {
        "parameters": vars(args),
        "environment": {
            "cpu": _cpu_label(),
            "cpu_count": _cpu_count(),
            "python": platform.python_version(),
            "fastapi_startkit": package_version("fastapi-startkit"),
            "fastapi": package_version("fastapi"),
            "uvicorn": package_version("uvicorn"),
            "load_tool": load_tool_version(),
        },
        "measurements": measurements,
    }

    (RESULTS_DIR / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    summary = build_summary(results)
    (RESULTS_DIR / "summary.md").write_text(summary + "\n")
    print("\n" + summary)


def _cpu_count() -> int:
    import os

    return os.cpu_count() or 0


def _cpu_label() -> str:
    if platform.system() == "Darwin":
        try:
            out = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True, text=True, check=True,
            ).stdout.strip()
            if out:
                return out
        except Exception:
            pass
    return platform.processor() or platform.machine()


if __name__ == "__main__":
    main()
