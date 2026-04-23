---
outline: deep
title: FastAPI Integration
---

# FastAPI Integration

Fastapi Startkit provides a seamless way to integrate and bootstrap FastAPI applications. By using the `FastAPIProvider`, you can maintain a clean separation between your application logic and the framework's configuration.

## Installation

To use FastAPI Integration, you need to install the `fastapi` extra:

```bash
uv add fastapi-startkit --extra fastapi
# or
pip install "fastapi-startkit[fastapi]"
```

## Setup

To enable FastAPI support, register the `FastAPIProvider` in your application providers list.

```python
# bootstrap/application.py
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider

app: Application = Application(
    base_path=...,
    providers=[
        FastAPIProvider,
        # ... other providers
    ]
)
```

## The FastAPI Provider

The `FastAPIProvider` is responsible for initializing the `FastAPI` instance and registering it with the application container. You can customize your FastAPI instance by extending this provider.

### Customizing the Instance

To change the title, version, or add global exception handlers, you can create your own provider:

```python
# app/providers/fastapi_provider.py
from fastapi import FastAPI
from fastapi_startkit.providers import Provider
from fastapi_startkit.fastapi.commands import ServeCommand

class MyFastAPIProvider(Provider):
    def register(self) -> None:
        """Create a FastAPI instance and register it."""
        fastapi = FastAPI(
            title="My Custom API",
            version="1.0.0",
        )

        # Register the instance with the application
        self.app.use_fastapi(fastapi)

    def boot(self):
        # Register core commands like 'serve'
        self.commands([
            ServeCommand
        ])
```

## Routing

Fastapi Startkit supports multiple ways to register routes.

### 1. Recommended: Using Routers

For better organization, we recommend defining routes in separate files using FastAPI's `APIRouter` and registering them in your provider's `boot` method.

**Step 1: Define your routes**

```python
# routes/api.py
from fastapi import APIRouter

router = APIRouter()

@router.get('/')
async def index():
    return {'message': 'Hello, FastAPI!'}
```

**Step 2: Register the router in your provider**

```python
# app/providers/fastapi_provider.py

class MyFastAPIProvider(Provider):
    # ... register method ...

    def boot(self):
        # Register commands
        self.commands([ServeCommand])
        
        # Import and register routes
        from routes.api import router
        self.app.include_router(router)
```

### 2. Simple Routing

For very small applications, you can register routes directly on the application instance.

```python
from bootstrap.application import app

@app.get('/')
async def hello():
    return {"message": "Hello World"}
```

While this is possible, the `APIRouter` approach is recommended for maintainability as your project grows.

## Serving the Application

When you register the `ServeCommand` in your provider, you gain access to the `serve` CLI command:

```bash
python artisan serve
```

This command uses Uvicorn to start your application with reasonable defaults and reload capabilities.

## Example Application

You can find a complete example of a FastAPI application built with Fastapi Startkit in our [example repository](https://github.com/fastapi-startkit/fastapi-startkit-modules/tree/main/example/fastapi-app).
