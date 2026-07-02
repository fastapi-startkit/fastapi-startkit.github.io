"""Baseline: a plain, hand-rolled FastAPI app.

Exposes the two TechEmpower-style endpoints the harness measures. This is the
honest baseline — the Startkit app below does the exact same work, so the
difference in throughput is the overhead the framework adds, nothing else.
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse, PlainTextResponse

app = FastAPI()


@app.get("/json")
async def json_endpoint():
    return JSONResponse({"message": "Hello, World!"})


@app.get("/plaintext")
async def plaintext_endpoint():
    return PlainTextResponse("Hello, World!")
