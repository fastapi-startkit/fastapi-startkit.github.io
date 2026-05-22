from fastapi_startkit.masoniteorm import Model, HasMany

class User(Model):
    id: int
    name: str
    email: str

    posts: list["Post"] = HasMany("Post")

class Post(Model):
    id: int
    user_id: int
    title: str
    content: str
