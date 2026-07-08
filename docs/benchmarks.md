---
outline: deep
title: Performance & Benchmarks
description: How FastAPI Startkit is benchmarked — measured in the public web-frameworks harness as a reproducible overhead delta over raw FastAPI.
keywords: fastapi benchmark, fastapi performance, fastapi startkit overhead, web-frameworks, load testing
---

# Performance & Benchmarks

FastAPI Startkit is a thin, provider-driven layer over FastAPI. The number that
actually matters is not "how fast is FastAPI" — that is FastAPI's story — but:

> **How much overhead does the Startkit layer add on top of raw FastAPI?**

FastAPI Startkit is benchmarked in a dedicated, public harness —
[**github.com/fastapi-startkit/web-frameworks**](https://github.com/fastapi-startkit/web-frameworks) —
which runs a raw FastAPI app and a FastAPI Startkit app through the **same
routes, the same container recipe, and the same load tool**. That repository is
the single source of truth for every figure on this page. The baseline is **raw
FastAPI only** — a delta between the two apps, not an apples-to-oranges
comparison against an unrelated stack.

## The result

The harness runs two Python entries that implement the **same three routes**
with identical handlers, on a matched stack (Python 3.14, FastAPI 0.139.0,
Starlette 1.3.1; `fastapi-startkit==0.47.0`, which resolves that same FastAPI /
Starlette). Both pass the shared route spec **6/6**.

On the same host the two run **close on the GET routes** and show a **larger,
explainable overhead on `POST /user`**. Relative delta (FastAPI Startkit vs raw
FastAPI; negative = Startkit slower):

| Route | Δ @ concurrency 64 | Δ @ concurrency 256 |
| --- | ---: | ---: |
| `GET /` | −2.9% | −6.4% |
| `GET /user/{id}` | −1.5% | −6.2% |
| `POST /user` | −17.3% | −18.8% |

<small>Source:
[web-frameworks — "FastAPI vs FastAPI-StartKit"](https://github.com/fastapi-startkit/web-frameworks/blob/develop/README.md#fastapi-vs-fastapi-startkit-python-benchmark).
Relative, same-host comparison (macOS + OrbStack · Docker `python:3.14-slim` ·
uvicorn · `oha` 1.14 · keep-alive · 8s × 4 reps · concurrency 64 and 256 · 100%
success in every cell) — **not official benchmark figures**. Absolute
throughput, host-specific and for context only: raw FastAPI ≈ 41–47k rps,
FastAPI Startkit ≈ 33–40k rps.</small>

### Why `POST /user` is slower

The gap is **not** Startkit per-request code — the hot path is stock FastAPI /
Starlette. It comes from **FastAPI 0.139's `include_router`**: unlike FastAPI
≤ 0.124 (which flattened included routes into the app router), 0.139 keeps a
nested `_IncludedRouter` node on `app.router.routes`, adding a per-request
resolution layer. This is intended FastAPI behavior and is **reproducible in
plain FastAPI** — any app that registers routes via `include_router` on 0.139
pays it. Startkit uses `include_router` as its idiomatic route-module
registration, so the benchmark surfaces this representative cost rather than
hiding it behind flat `add_api_route`. It is a long-standing FastAPI topic; see
the upstream discussion
[fastapi/fastapi#5343](https://github.com/fastapi/fastapi/issues/5343).

## Why overhead-delta, not a vanity number

A single large "req/s" figure on a marketing page is meaningless without the
hardware, worker count, payload, and client that produced it. Worse, comparing
against an unrelated framework invites an apples-to-oranges reading.

The honest, decision-useful question for someone choosing Startkit is simply:
*what does building on it cost me versus hand-writing FastAPI?* That is a
**delta**, and a delta is reproducible on any machine — the absolute numbers move
with your hardware, but the gap between the two apps does not.

## Test types

Three routes, kept byte-for-byte identical between the two apps:

| Route | Method | Response |
| --- | --- | --- |
| `/` | GET | empty body |
| `/user/{id}` | GET | the `id` as plaintext |
| `/user` | POST | empty body |

The **raw** app registers them on a single `FastAPI()` instance in `server.py`;
the **Startkit** app boots an `Application` with the default `FastAPIProvider`
and registers the same three routes through the framework's router
(`providers/`, `config/`, `bootstrap/`) — i.e. the way you would actually write
a Startkit app.

## Method & load-testing hygiene

The measurement above comes from the web-frameworks harness. For each Python
entry it:

1. builds the app into the same Docker image (`python:3.14-slim`) and runs it
   under uvicorn with one worker per core (`--workers=nproc`, 11 on the
   reference host);
2. drives it with [`oha`](https://github.com/hatoo/oha) using keep-alive /
   connection reuse and latency correction;
3. runs 8-second reps × 4, averaged, at concurrency 64 and 256, requiring
   **100% success** in every cell.

Both entries are built and run from the same container recipe and the same
matched FastAPI / Starlette stack, so the comparison isolates the framework
layer rather than environment differences. Because `fastapi-startkit` adds its
wiring (provider / router / container setup) at **boot**, not on the per-request
path, the per-request hot path is the same FastAPI / Starlette routing on both
sides.

### Known limitations

- **Relative, not official.** These are same-host (macOS / OrbStack) figures
  using keep-alive, not the harness's authoritative `--disable-keepalive` mode.
  Reliable absolute throughput / latency requires the Linux harness (`run.sh`);
  absolute numbers under `--disable-keepalive` were not obtainable on macOS due
  to ephemeral-port / `TIME_WAIT` exhaustion.
- **Absolute numbers are host-dependent.** Treat the per-route delta as the
  portable result and re-run on your own hardware for absolute figures.
- **`POST /user` reflects FastAPI, not framework code.** The overhead there is
  FastAPI 0.139's `include_router` resolution, reproducible in plain FastAPI.

## Reproduce it

The benchmark harness is maintained in a dedicated repository — it is the single
source of truth for how FastAPI Startkit is measured:

**[github.com/fastapi-startkit/web-frameworks](https://github.com/fastapi-startkit/web-frameworks)**

Clone it and follow the instructions in its README to build the apps, run the
load tests, and regenerate the results. The two Python entries live under
`python/fastapi` and `python/fastapi_startkit`:

```bash
git clone https://github.com/fastapi-startkit/web-frameworks
cd web-frameworks
```

Keeping the harness in its own repository means the benchmark can evolve — new
frameworks, endpoints, and load profiles — independently of these docs, while
every figure on this page stays traceable to a public, reproducible source.
