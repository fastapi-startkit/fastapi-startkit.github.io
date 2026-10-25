---
outline: deep
title: ORM Factories & Seeders
description: Generate realistic test data and populate your database with factories and seeders in FastAPI Startkit.
keywords: orm, factory, seeder, test data, fake data, database, fastapi startkit
---

# ORM Factories & Seeders

When you test your application or fill a development database, you need data, and writing it out by hand gets old quickly. FastAPI Startkit gives you two tools for the job, and they work well together.

A factory builds one model with random fake data. You'll mostly use factories in tests, where each call should produce a fresh record. A seeder, on the other hand, inserts a fixed set of rows, such as admin users or categories, to set up a development or staging database.

## Factories

### Defining a Factory

Factories live in `databases/factories/`. To write one, extend `Factory`, set `model`, and return the field values from `definition()`. Inside it, `self.fake` is a [Faker](https://faker.readthedocs.io/) instance you can use to generate names, emails, and so on:

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

Once the factory is defined, `create()` inserts a record and returns the saved model:

```python
user = await UserFactory.new().create()
print(user.id)         # set by the database
print(user.email)      # a unique fake email
```

To pin down specific fields, pass them as keyword arguments:

```python
admin = await UserFactory.new().create(owner=True, email="admin@example.com")
```

### `factory.make()` — Build Without Saving

Sometimes you just need a model object, not a database row. `make()` builds the model in memory and doesn't touch the database:

```python
user = await UserFactory.new().make()
assert user.first_name
assert user.id is None
```

It accepts overrides the same way:

```python
user = await UserFactory.new().make(email="test@example.com")
```

### Creating Multiple Records

To build several records at once, call `.count(n)` first to get a list of `n` models:

```python
users = await UserFactory.new().count(10).create()   # 10 saved users
drafts = await UserFactory.new().count(5).make()     # 5 unsaved users
```

With `count(n)` for `n` greater than 1 you get a list. Without `count()`, or with `count(1)`, you get a single model.

### States / Variations

Often you'll want a variation of the same model, like a suspended user. A state is a named override applied on top of `definition()`. You define it as a method that calls `self.state()` with a callback returning the fields to change:

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

Then call the state before `create()` or `make()`:

```python
user = await UserFactory.new().suspended().create()
assert user.account_status == "suspended"
```

States chain with each other and with `count()`. They're applied in order, and each callback receives the attributes built so far:

```python
user = await UserFactory.new().suspended().count(3).create()
```

### Lifecycle Hooks

If you need to run code after a model is built or saved, register callbacks in `configure()`. They run after `make()` or `create()`:

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

Factories can build related records for you, too. `has()` creates related records after the parent is saved, using `{parent_table_singular}_id` as the foreign key:

```python
org = await OrganizationFactory.new().has(ContactFactory.new().count(3)).create()
```

Going the other direction, `for_()` creates the parent first and sets its id on the child:

```python
contact = await ContactFactory.new().for_(OrganizationFactory.new()).create()
```

### Complete Factory Example

Here's a complete factory for a `Contact` model:

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

Seeders live in `databases/seeders/`. Each one extends `Seeder` and implements `async run()`:

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

Since `first_or_create` skips rows that already exist, the seeder is safe to run twice.

### Combining Factories and Seeders

This is where the two tools meet. When you need a lot of varied data, use factories inside a seeder:

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

`db:seed` runs `DatabaseSeeder` by default, so it's a good place to call your other seeders with `self.call()`:

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

Each seeder finishes before the next starts, so order matters. In this example, categories must exist before the courses that reference them.

### Running Seeders via Artisan

To run `DatabaseSeeder`, use `db:seed`:

```bash
uv run python artisan db:seed
```

To run a single seeder class, pass it with `--class`:

```bash
uv run python artisan db:seed --class UserSeeder
```

For a seeder in a sub-directory, give a dotted path relative to the seed directory:

```bash
uv run python artisan db:seed --class admin.user_seeder.UserSeeder
```

This loads `UserSeeder` from `databases/seeders/admin/user_seeder.py`.

You can also point at a different seed directory with `--directory` (the default is `databases/seeders`):

```bash
uv run python artisan db:seed --directory databases/demo_seeders
```

### Generating a Seeder File

Rather than writing a seeder from scratch, you can let the `seed` command generate a stub:

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
