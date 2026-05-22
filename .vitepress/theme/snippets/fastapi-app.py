# bootstrap/application.py
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider  # [+]
from fastapi_startkit.logging import LoggerProvider
from pathlib import Path

app: Application = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        LoggerProvider,
        # Register FastAPIProvider to bind the fastapi to the application,
        FastAPIProvider  # [+]
    ]
)

# Bind your routes to fastapi.
from routes.api import router
app.include_router(router)
# `uv run python artisan serve` to serve the fastapi application
