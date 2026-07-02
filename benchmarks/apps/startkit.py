"""FastAPI Startkit app serving the identical endpoints via the framework.

Routes are registered through the framework's Router and the app is booted with
the default FastAPIProvider stack, so the measured throughput reflects real
idiomatic Startkit usage — not a stripped-down special case.
"""

from pathlib import Path

from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider, Router

application = Application(
    base_path=str(Path(__file__).parent),
    providers=[FastAPIProvider],
)

router = Router()


async def json_endpoint():
    return JSONResponse({"message": "Hello, World!"})


async def plaintext_endpoint():
    return PlainTextResponse("Hello, World!")


router.get("/json", json_endpoint)
router.get("/plaintext", plaintext_endpoint)

application.include_router(router)

app = application.fastapi
