---
outline: deep
title: ORM Factories & Seeders
description: Generate realistic test data and populate your database with factories and seeders in Fastapi Startkit.
keywords: orm, factory, seeder, test data, fake data, database, fastapi startkit
---

# ORM Factories & Seeders

A factory builds one model with random fake data. Use factories in tests, where each call should produce a fresh record.

A seeder inserts a fixed set of rows, such as admin users or categories, to set up a development or staging database.

## Factories

### Defining a Factory

Create the factory in `databases/factories/`. Extend `Factory`, set `model`, and return the field values from `definition()`. `self.fake` is a [Faker](https://faker.readthedocs.io/) instance:

```python
# databases/factories/UserFactory.py
from fastapi_startkit.masoniteorm.factory import Factory
from app.models.User import User


class UserFactory(Factory):
    model = User

    def definition(self):
        return {
            "first_name": self.fake.first_name(),
            "last_name": self.fake.last_name(),
            "email": self.fake.unique.email(),
            "password": "secret",
            "owner": False,
        }
```

### `factory.create()` — Persist to the Database

`create()` inserts the record and returns the saved model:

```python
user = await UserFactory.new().create()
print(user.id)         # set by the database
print(user.email)      # a unique fake email
```

Pass keyword arguments to override fields:

```python
admin = await UserFactory.new().create(owner=True, email="admin@example.com")
```

### `factory.make()` — Build Without Saving

`make()` builds the model in memory and does not touch the database:

```python
user = await UserFactory.new().make()
assert user.first_name
assert user.id is None
```

It takes overrides the same way:

```python
user = await UserFactory.new().make(email="test@example.com")
```

### Creating Multiple Records

Call `.count(n)` first to get a list of `n` models:

```python
users = await UserFactory.new().count(10).create()   # 10 saved users
drafts = await UserFactory.new().count(5).make()     # 5 unsaved users
```

With `count()` you always get a list, even for `count(1)`. Without it you get a single model.

### States / Variations

A state is a named override applied on top of `definition()`. Define it as a method that calls `self.state()` with a callback returning the fields to change:

```python
class UserFactory(Factory):
    model = User

    def definition(self):
        return {
            "first_name": self.fake.first_name(),
            "last_name": self.fake.last_name(),
            "email": self.fake.unique.email(),
            "password": "secret",
            "account_status": "active",
        }

    def suspended(self):
        return self.state(lambda attributes: {
            "account_status": "suspended",
        })
```

Call the state before `create()` or `make()`:

```python
user = await UserFactory.new().suspended().create()
assert user.account_status == "suspended"
```

States chain with each other and with `count()`. They are applied in order, and each callback receives the attributes built so far:

```python
user = await UserFactory.new().suspended().count(3).create()
```

### Lifecycle Hooks

Register callbacks in `configure()` to run after `make()` or `create()`:

```python
class UserFactory(Factory):
    model = User

    def definition(self):
        return {
            "first_name": self.fake.first_name(),
            "email": self.fake.unique.email(),
            "password": "secret",
        }

    def configure(self):
        async def after_making(user):
            print(f"Built: {user.first_name}")

        async def after_creating(user):
            print(f"Persisted: {user.first_name} (id={user.id})")

        return self.after_making(after_making).after_creating(after_creating)
```

`Factory.new()` calls `configure()` for you. It must return `self`, which `after_making()` and `after_creating()` both do.

### Relationships

`has()` creates related records after the parent is saved. The foreign key is `{parent_table_singular}_id`:

```python
org = await OrganizationFactory.new().has(ContactFactory.new().count(3)).create()
```

`for_()` creates the parent first and sets its id on the child:

```python
contact = await ContactFactory.new().for_(OrganizationFactory.new()).create()
```

### Complete Factory Example

```python
# databases/factories/ContactFactory.py
from fastapi_startkit.masoniteorm.factory import Factory
from app.models.Contact import Contact


class ContactFactory(Factory):
    model = Contact

    def definition(self):
        return {
            "first_name": self.fake.first_name(),
            "last_name": self.fake.last_name(),
            "email": self.fake.unique.email(),
            "phone": self.fake.phone_number(),
            "city": self.fake.city(),
            "country": "US",
        }
```

## Seeders

### Defining a Seeder

Put seeders in `databases/seeders/`. Extend `Seeder` and implement `async run()`:

```python
# databases/seeders/category_seeder.py
from fastapi_startkit.masoniteorm.seeders import Seeder
from app.models.category import Category


class CategorySeeder(Seeder):
    async def run(self):
        categories = ["Programming", "Web Development", "Data Science", "Design"]
        for name in categories:
            await Category.first_or_create({"name": name})
```

`first_or_create` skips rows that already exist, so the seeder is safe to run twice.

### Combining Factories and Seeders

Use factories inside a seeder when you need a lot of varied data:

```python
# databases/seeders/database_seeder.py
from fastapi_startkit.masoniteorm.seeders import Seeder
from app.models.Account import Account
from app.models.User import User
from databases.factories.UserFactory import UserFactory
from databases.factories.OrganizationFactory import OrganizationFactory
from databases.factories.ContactFactory import ContactFactory
import random


class DatabaseSeeder(Seeder):
    async def run(self):
        account = await Account.create({"name": "Acme Corporation"})

        await User.first_or_create(
            {"email": "admin@example.com"},
            {
                "account_id": account.id,
                "first_name": "Admin",
                "last_name": "User",
                "password": "secret",
                "owner": True,
            },
        )

        await UserFactory.new().count(5).create(account_id=account.id)

        organizations = await OrganizationFactory.new().count(100).create(account_id=account.id)

        for _ in range(100):
            await ContactFactory.new().create(
                account_id=account.id,
                organization_id=random.choice(organizations).id,
            )
```

### Orchestrating Seeders with `self.call()`

`db:seed` runs `DatabaseSeeder` by default. Call the other seeders from it with `self.call()`:

```python
# databases/seeders/database_seeder.py
from fastapi_startkit.masoniteorm.seeders import Seeder
from .category_seeder import CategorySeeder
from .user_seeder import UserSeeder
from .course_seeder import CourseSeeder


class DatabaseSeeder(Seeder):
    async def run(self):
        await self.call(CategorySeeder)
        await self.call(UserSeeder)
        await self.call(CourseSeeder)
```

Each seeder finishes before the next starts. Here categories must exist before the courses that reference them.

### Running Seeders via Artisan

Run `DatabaseSeeder`:

```bash
uv run python artisan db:seed
```

Run one seeder class:

```bash
uv run python artisan db:seed --class UserSeeder
```

Give a dotted path for a seeder in another module:

```bash
uv run python artisan db:seed --class databases.seeders.user_seeder.UserSeeder
```

Point at a different seed directory with `--directory` (default `databases/seeders`):

```bash
uv run python artisan db:seed --directory databases/demo_seeders
```

### Generating a Seeder File

`seed` generates a seeder stub:

```bash
uv run python artisan seed Post
```

This creates `databases/seeders/post_table_seeder.py` containing a `PostTableSeeder` class:

```python
"""PostTableSeeder Seeder."""

from fastapi_startkit.masoniteorm.seeders import Seeder


class PostTableSeeder(Seeder):
    async def run(self):
        """Run the database seeds."""
        pass
```
