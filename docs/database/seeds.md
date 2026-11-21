---
outline: deep
title: Seeds
description: Fill your database with known data using seeder classes in FastAPI Startkit.
keywords: database, seeding, seeders, test data, python, fastapi
---

# Seeds

Seeders insert a known set of rows into your database, such as an admin account, a list of categories or a few demo posts. You run them with one command whenever you set up a fresh development or staging database, so everyone on the team starts from the same data.

- [Writing Seeders](#writing-seeders)
- [Calling Additional Seeders](#calling-additional-seeders)
- [Using Model Factories](#using-model-factories)
- [Running Seeders](#running-seeders)

## Writing Seeders

To generate a seeder, run the `seed` command with a name. The command adds `TableSeeder` to the name and writes the file to `databases/seeders`:

```bash
uv run python artisan seed Post
# Seed file created: databases/seeders/post_table_seeder.py
```

A seeder extends `Seeder` and does its work in an async `run` method. You can also write seeder files by hand. For example, this seeder creates two users:

```python
# databases/seeders/user_seeder.py
from fastapi_startkit.masoniteorm.seeders import Seeder

from app.models.user import User


class UserSeeder(Seeder):
    async def run(self):
        await User.first_or_create(
            {"email": "admin@example.com"},
            {"name": "Admin User", "password": "secret", "is_admin": True},
        )
        await User.first_or_create(
            {"email": "jane@example.com"},
            {"name": "Jane Doe", "password": "secret"},
        )
```

`first_or_create` only inserts a row when no row matches the first dictionary, so you can run the seeder again without creating duplicates.

A seeder can use any model, including a pivot model. This one creates a post and links it to two tags:

```python
# databases/seeders/post_seeder.py
from fastapi_startkit.masoniteorm.seeders import Seeder

from app.models import Post, PostTag, Tag, User


class PostSeeder(Seeder):
    async def run(self):
        author = await User.where("email", "admin@example.com").first()

        python = await Tag.first_or_create({"name": "python"})
        fastapi = await Tag.first_or_create({"name": "fastapi"})

        post = await Post.first_or_create(
            {"title": "Getting Started with FastAPI"},
            {"user_id": author.id, "body": "Install the framework and add your first route."},
        )

        await PostTag.first_or_create({"post_id": post.id, "tag_id": python.id})
        await PostTag.first_or_create({"post_id": post.id, "tag_id": fastapi.id})
```

## Calling Additional Seeders

`db:seed` runs the `DatabaseSeeder` class in `databases/seeders/database_seeder.py`. Use it as the entry point and call your other seeders from it with `self.call()`:

```python
# databases/seeders/database_seeder.py
from fastapi_startkit.masoniteorm.seeders import Seeder

from .post_seeder import PostSeeder
from .user_seeder import UserSeeder


class DatabaseSeeder(Seeder):
    async def run(self):
        await self.call(UserSeeder, PostSeeder)
```

`self.call()` runs the seeders one after another, in the order you pass them, and waits for each to finish. List them in dependency order: here `PostSeeder` needs the admin user that `UserSeeder` creates.

## Using Model Factories

When you need a lot of varied data, use [model factories](/docs/orm-factory) inside a seeder instead of writing each row by hand. For example, this seeder creates ten users with three posts each:

```python
# databases/seeders/demo_seeder.py
from fastapi_startkit.masoniteorm.seeders import Seeder

from databases.factories.post_factory import PostFactory
from databases.factories.user_factory import UserFactory


class DemoSeeder(Seeder):
    async def run(self):
        await UserFactory.new().count(10).has(PostFactory.new().count(3)).create()
```

## Running Seeders

To run `DatabaseSeeder`, use the `db:seed` command:

```bash
uv run python artisan db:seed
# Database Seeder seeded!
```

To run one seeder class, pass its name with `--class`. The command looks for the class in the snake_case file of the same name, so `UserSeeder` is loaded from `databases/seeders/user_seeder.py`:

```bash
uv run python artisan db:seed --class UserSeeder
```

For a seeder in a sub-directory, or one whose file name doesn't match the class, pass a dotted path relative to the seed directory. This loads `UserSeeder` from `databases/seeders/admin/user_seeder.py`:

```bash
uv run python artisan db:seed --class admin.user_seeder.UserSeeder
```

Seeders generated with the `seed` command can also be run by the name you gave them. This runs `PostTableSeeder` from `databases/seeders/post_table_seeder.py`:

```bash
uv run python artisan db:seed Post
```

Seeders are loaded from `databases/seeders` by default. To use another directory, pass `--directory`. It must contain its own `database_seeder.py` when you run it without `--class`:

```bash
uv run python artisan db:seed --directory databases/demo_seeders
```
