# Benchmark results

- **Host:** Apple M3 Pro (11 logical cores)
- **Python:** 3.13.7
- **fastapi-startkit:** 0.46.0 · **fastapi:** 0.124.4 · **uvicorn:** 0.49.0
- **Load tool:** This is ApacheBench, Version 2.3 <$Revision: 1913912 $>
- **Parameters:** 60,000 requests · concurrency 64 · peak of 8 trials · single uvicorn worker · keep-alive

| Endpoint | Raw FastAPI (req/s) | FastAPI Startkit (req/s) | Overhead |
| --- | ---: | ---: | ---: |
| JSON serialization | 18,552 | 19,116 | -3.0% |
| Plaintext | 19,745 | 20,038 | -1.5% |

