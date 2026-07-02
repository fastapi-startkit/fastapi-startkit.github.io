# FastAPI Startkit — benchmark harness

A small, reproducible harness that answers one honest question:

> **How much overhead does FastAPI Startkit add on top of raw FastAPI?**

The baseline is **raw FastAPI only**. Both apps serve byte-identical responses,
so any difference in throughput is framework overhead — nothing else. There is
deliberately no comparison against unrelated stacks (Django, Express, …), which
would say more about those stacks than about Startkit.

## What it measures

Two [TechEmpower](https://www.techempower.com/benchmarks/)-style endpoints:

| Endpoint | Type |
| --- | --- |
| `/json` | JSON serialization |
| `/plaintext` | Plaintext |

against two apps:

- `apps/raw.py` — a plain, hand-rolled FastAPI app.
- `apps/startkit.py` — the same endpoints registered through the framework's
  `Router` and booted with the default `FastAPIProvider` stack.

## Requirements

- Python ≥ 3.12
- [`uv`](https://docs.astral.sh/uv/)
- [ApacheBench](https://httpd.apache.org/docs/2.4/programs/ab.html) (`ab`) on `PATH`
  (ships with macOS; `apt install apache2-utils` on Debian/Ubuntu)

## Run it

```bash
cd benchmarks
uv sync
uv run python bench.py
```

Tune the load:

```bash
uv run python bench.py --requests 100000 --concurrency 128 --trials 8 --warmup 8000
```

## Method

For every (app, endpoint) pair the harness:

1. boots the app under a single uvicorn worker (identical config for both);
2. waits for readiness, then fires a warm-up batch that is discarded;
3. runs `ab` under keep-alive for `--trials` trials;
4. records the **peak** requests/sec across trials.

Peak — not mean — is the meaningful capacity number: background contention on a
shared machine can only slow a trial down, never push it past the app's true
ceiling. Reporting the peak keeps the comparison fair when the host is busy.

## Output

- `results/results.json` — full results plus environment metadata (CPU, package
  versions, load-test parameters, every trial).
- `results/summary.md` — the human-readable table rendered on the
  [Performance & Benchmarks](https://fastapi-startkit.github.io/docs/benchmarks)
  methodology page.

## Known limitations

- `ab` is a single-threaded HTTP/1.1 client; on fast hardware it can become the
  bottleneck before the server does. That caps the **absolute** numbers, but the
  **overhead delta** stays valid because both apps are driven identically.
- Single worker isolates per-request framework overhead. Real deployments run
  multiple workers and scale roughly linearly with cores.
- Numbers are hardware- and load-dependent. Re-run on your own machine rather
  than treating any single figure as absolute.
