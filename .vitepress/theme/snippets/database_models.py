from fastapi_startkit.masoniteorm import Model, HasMany

class User(Model):
    id: int
    name: str
    email: str
    password: str

    # Note: Showing a HasMany relationship example (Post schema not pictured).
    posts: list["Post"] = HasMany("Post")

class Post(Model):
    id: int
    user_id: int
    title: str
    content: str

# Then you can use the models in your application:
# from app.models import User, Post
# user = await User.find(1)
# user_with_posts = await User.with_('posts').find(1)
