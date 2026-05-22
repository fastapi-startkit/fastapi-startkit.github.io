# bootstrap/application.py
from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.logging import LoggerProvider

# A lightweight background worker with zero web overhead,
# No FastAPI, no database ORMs, no frontend assets—just pure, lean Python.
# Automatically loads .env files and exposes a structured CLI engine.
app: Application = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        # Configures uniform logs across terminal, files, syslog, or Slack
        LoggerProvider,
    ]
)
