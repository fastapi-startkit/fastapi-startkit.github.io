---
outline: deep
title: Seeds
description: Populate your database with test data using seeder files in Fastapi Startkit.
keywords: database, seeding, test data, python, fastapi
---

# Seeds

A seeder inserts a known set of rows into your database. Seeders are async classes, and one seeder can call others.

## Creating a Seeder

Put seeders in `databases/seeders/`. Extend `Seeder` and implement an async `run` method:

```python
# databases/seeders/user_seeder.py
from fastapi_startkit.masoniteorm.seeders import Seeder
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

`first_or_create` only inserts a row when no match exists, so you can run the seeder again without creating duplicates.

## Database Seeder (Entry Point)

`DatabaseSeeder` is the seeder `db:seed` runs by default. Call your other seeders from it:

```python
# databases/seeders/database_seeder.py
from fastapi_startkit.masoniteorm.seeders import Seeder
from .user_seeder import UserSeeder
from .post_seeder import PostSeeder

class DatabaseSeeder(Seeder):
    async def run(self):
        await self.call(UserSeeder)
        await self.call(PostSeeder)
```

`self.call` waits for each seeder to finish before starting the next, so list them in dependency order. Here posts need users to exist first.

## Complete Example

The blog example seeds tags, posts, and the pivot rows that link them:

```python
# databases/seeders/post_seeder.py
from fastapi_startkit.masoniteorm.seeders import Seeder
from app.models import Post, User, Tag, PostTag

class PostSeeder(Seeder):
    async def run(self):
        user = await User.first()
        if not user:
            return

        tag_python   = await Tag.first_or_create({"name": "python"})
        tag_fastapi  = await Tag.first_or_create({"name": "fastapi"})
        tag_database = await Tag.first_or_create({"name": "database"})

        post1 = await Post.create({
            "user_id": user.id,
            "title": "Python and Databases",
            "content": "This is a post about Python and its database capabilities.",
        })
        await PostTag.first_or_create({"post_id": post1.id, "tag_id": tag_python.id})
        await PostTag.first_or_create({"post_id": post1.id, "tag_id": tag_database.id})

        post2 = await Post.create({
            "user_id": user.id,
            "title": "FastAPI and Databases",
            "content": "This is a post about FastAPI performance and database handling.",
        })
        await PostTag.first_or_create({"post_id": post2.id, "tag_id": tag_fastapi.id})
        await PostTag.first_or_create({"post_id": post2.id, "tag_id": tag_database.id})
```

## Running Seeds

Run `DatabaseSeeder`:

```bash
uv run python artisan db:seed
```

Run one seeder class:

```bash
uv run python artisan db:seed --class UserSeeder
```
