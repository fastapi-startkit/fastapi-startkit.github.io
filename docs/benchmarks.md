---
outline: deep
title: Performance & Benchmarks
description: How FastAPI Startkit is benchmarked — a reproducible, honest overhead-delta harness measuring the framework's cost over raw FastAPI.
keywords: fastapi benchmark, fastapi performance, fastapi startkit overhead, techempower, load testing
---

# Performance & Benchmarks

FastAPI Startkit is a thin, provider-driven layer over FastAPI. The number that
actually matters is not "how fast is FastAPI" — that is FastAPI's story — but:

> **How much overhead does the Startkit layer add on top of raw FastAPI?**

This page documents exactly how we answer that, so you can reproduce every figure
yourself. The baseline is **raw FastAPI only**. We do not benchmark against
Django, Express, or any other stack — such comparisons say more about those
stacks than about Startkit, and they cannot be reproduced honestly.

## The result

On the reference machine below, FastAPI Startkit runs at **parity with raw
FastAPI** — the differences fall within run-to-run noise and land on both sides
of zero, so there is **no measurable throughput overhead**.

| Endpoint | Raw FastAPI (req/s) | FastAPI Startkit (req/s) | Difference |
| --- | ---: | ---: | ---: |
| JSON serialization | 18,552 | 19,116 | −3.0% |
| Plaintext | 19,745 | 20,038 | −1.5% |

<small>Peak of 8 trials · 60,000 requests · concurrency 64 · single uvicorn
worker · keep-alive. Apple M3 Pro (11 logical cores) · Python 3.13 ·
fastapi-startkit 0.46.0 · fastapi 0.124.4 · uvicorn 0.49.0 · ApacheBench 2.3.</small>

A negative difference means Startkit measured *faster* on that run — which only
confirms the two are statistically indistinguishable. The framework's `Router`
and default `FastAPIProvider` boot add no per-request cost you can see above the
noise floor.

## Why overhead-delta, not a vanity number

A single large "req/s" figure on a marketing page is meaningless without the
hardware, worker count, payload, and client that produced it. Worse, comparing
against an unrelated framework invites an apples-to-oranges reading.

The honest, decision-useful question for someone choosing Startkit is simply:
*what does building on it cost me versus hand-writing FastAPI?* That is a
**delta**, and a delta is reproducible on any machine — the absolute numbers move
with your hardware, but the gap between the two apps does not.

## Test types

Two [TechEmpower](https://www.techempower.com/benchmarks/)-style endpoints, kept
byte-for-byte identical between the two apps:

| Endpoint | Type | Response |
| --- | --- | --- |
| `/json` | JSON serialization | `{"message": "Hello, World!"}` |
| `/plaintext` | Plaintext | `Hello, World!` |

Both apps expose exactly these two routes. The **raw** app registers them with
plain FastAPI decorators; the **Startkit** app registers them through the
framework's `Router` and boots with the default `FastAPIProvider` — i.e. the way
you would actually write a Startkit app.

## Method & load-testing hygiene

For every (app, endpoint) pair the harness:

1. boots the app under a **single uvicorn worker**, with identical configuration
   for both apps;
2. waits for the server to become ready, then fires a **warm-up batch** that is
   discarded (so import, JIT, and connection setup don't skew the first trial);
3. runs [`ab`](https://httpd.apache.org/docs/2.4/programs/ab.html) under
   **keep-alive** for several trials;
4. records the **peak** requests/sec across trials.

We report the **peak**, not the mean. On a shared machine, background contention
can only ever *slow* a trial down — it can never push throughput past the app's
true ceiling. The peak is therefore the cleanest estimate of real capacity, and
because both apps are measured under the same conditions the comparison stays
fair. A single uvicorn worker is used on purpose: it isolates the framework's
per-request overhead instead of measuring how many cores the host has.

### Known limitations

- **The client can be the bottleneck.** `ab` is a single-threaded HTTP/1.1
  client; on fast hardware it can saturate before the server does, which caps the
  *absolute* numbers. The *delta* remains valid because both apps are driven
  identically.
- **Single worker ≠ production throughput.** Real deployments run multiple
  workers and scale roughly linearly with cores. These numbers isolate overhead;
  they are not a peak-capacity claim for a tuned deployment.
- **Numbers are host-dependent.** Treat the delta as the portable result and
  re-run on your own hardware for absolute figures.

## Reproduce it

The full harness lives in
[`benchmarks/`](https://github.com/fastapi-startkit/fastapi-startkit.github.io/tree/main/benchmarks)
in the docs repository.

```bash
cd benchmarks
uv sync
uv run python bench.py
```

Tune the load parameters as needed:

```bash
uv run python bench.py --requests 100000 --concurrency 128 --trials 8 --warmup 8000
```

Each run writes machine-readable results and environment metadata to
`benchmarks/results/results.json` and the summary table to
`benchmarks/results/summary.md`.
