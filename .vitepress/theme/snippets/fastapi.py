# routes/api.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def index():
    return {"message": "Hello, FastAPI!"}

@router.post("/items")
async def create_item(item: ItemSchema):
    return item
