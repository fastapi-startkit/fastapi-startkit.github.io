# bootstrap/application.py
from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.logging import LoggerProvider

# Initialize Application with logging and fastapi
app: Application = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        LoggerProvider,
        FastAPIProvider
    ]
)
