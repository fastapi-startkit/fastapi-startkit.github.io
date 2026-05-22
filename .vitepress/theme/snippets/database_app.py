# bootstrap/application.py
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.logging import LoggerProvider
from fastapi_startkit.masoniteorm import DatabaseProvider # [+]
from pathlib import Path
# FastAPI Startkit ships with a fully async MasoniteORM provider.
# Use it for an elegant, Active Record workflow—or completely swap it
# for SQLAlchemy, SQLModel, or any async database stack you prefer.
app: Application = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        LoggerProvider,
        FastAPIProvider,
        DatabaseProvider # [+]
    ]
)
