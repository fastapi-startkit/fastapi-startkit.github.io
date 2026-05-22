# routes/api.py

# Define your FastAPI routes as it is using fastapi's APIRouter
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def index():
    return {"message": "Hello, FastAPI!"}
