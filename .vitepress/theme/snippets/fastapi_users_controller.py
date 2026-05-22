# app/http/controllers/users_controller.py
async def index(request: Request):
    return await User.all()

async def show(user_id: int):
    return await User.find(user_id)

async def store(data: UserSchema):
    return await User.create(**data.model_dump())

async def update(user_id: int, data: UserSchema):
    user = await User.find(user_id)
    return await user.update(**data.model_dump())

async def destroy(user_id: int):
    user = await User.find(user_id)
    await user.delete()
