---
outline: deep
title: Seeds
---

# Seeds

Seeders populate your database with initial or test data. They are async classes that can call other seeders, making it easy to compose complex datasets from focused, single-responsibility classes.

## Creating a Seeder

Place seeder files in `databases/seeds/`. Extend `Seeder` and implement an async `run` method:

```python
# databases/seeds/user_seeder.py
from fastapi_startkit.masoniteorm.seeds import Seeder
from app.models.user import User

class UserSeeder(Seeder):
    async def run(self):
        await User.first_or_create(
            {"email": "admin@example.com"},
            {"name": "Admin User", "password": "secret"}
        )
        await User.first_or_create(
            {"email": "john@example.com"},
            {"name": "John Doe", "password": "secret"}
        )
```

Using `first_or_create` makes seeders idempotent — running them multiple times will not create duplicate records.

## Database Seeder (Entry Point)

Create a `DatabaseSeeder` that calls your individual seeders in the correct order:

```python
# databases/seeds/database_seeder.py
from fastapi_startkit.masoniteorm.seeds import Seeder
from .user_seeder import UserSeeder
from .post_seeder import PostSeeder

class DatabaseSeeder(Seeder):
    async def run(self):
        await self.call(UserSeeder)
        await self.call(PostSeeder)
```

`self.call` runs a seeder and waits for it to complete before continuing. Order matters when seeders have dependencies (e.g. posts require users to exist first).

## Complete Example

The blog example seeds users, tags, posts, and pivot records:

```python
# databases/seeds/post_seeder.py
from fastapi_startkit.masoniteorm.seeds import Seeder
from app.models import Post, User, Tag, PostTag

class PostSeeder(Seeder):
    async def run(self):
        user = await User.first()
        if not user:
            return

        # Create tags
        tag_laravel  = await Tag.first_or_create({"name": "laravel"})
        tag_fastapi  = await Tag.first_or_create({"name": "fastapi"})
        tag_database = await Tag.first_or_create({"name": "database"})

        # Create first post and attach tags
        post1 = await Post.create(
            user_id=user.id,
            title="Laravel and Databases",
            content="This is a post about Laravel and its database capabilities."
        )
        await PostTag.first_or_create({"post_id": post1.id, "tag_id": tag_laravel.id})
        await PostTag.first_or_create({"post_id": post1.id, "tag_id": tag_database.id})

        # Create second post and attach tags
        post2 = await Post.create(
            user_id=user.id,
            title="FastAPI and Databases",
            content="This is a post about FastAPI performance and database handling."
        )
        await PostTag.first_or_create({"post_id": post2.id, "tag_id": tag_fastapi.id})
        await PostTag.first_or_create({"post_id": post2.id, "tag_id": tag_database.id})
```

## Running Seeds

Run all seeds via the `DatabaseSeeder` entry point:

```bash
python artisan db:seed
```

To run a specific seeder class:

```bash
python artisan db:seed --class UserSeeder
```
