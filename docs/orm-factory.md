---
outline: deep
title: ORM Factories & Seeders
description: Generate realistic test data and populate your database with factories and seeders in Fastapi Startkit.
keywords: orm, factory, seeder, test data, fake data, database, fastapi startkit
---

# ORM Factories & Seeders

Factories and seeders are two complementary tools for populating your database with data.

**Factories** define how to generate a single model instance with realistic fake data. They are designed for tests — each call produces a fresh record with randomised values, and they compose cleanly to handle relationships.

**Seeders** are async classes that insert a known, deterministic dataset. They are typically used to bootstrap a development or staging environment with a curated set of records (admin users, categories, demo content, etc.).

## Factories

### Defining a Factory

Create a factory class in `databases/factories/`. Extend `Factory`, declare the `model` it produces, and implement `definition()` to return a dictionary of field values.

The `fake` attribute is a pre-wired [Faker](https://faker.readthedocs.io/) instance available on every factory:

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

Call `Factory.new().create()` to insert a record and return the saved model instance:

```python
user = await UserFactory.new().create()
print(user.id)         # set by the database
print(user.email)      # a unique fake email
```

Pass keyword arguments to override specific fields:

```python
admin = await UserFactory.new().create(owner=True, email="admin@example.com")
```

### `factory.make()` — Build Without Saving

`make()` builds a model instance in memory without writing to the database. Useful for unit tests that do not require a database connection:

```python
user = await UserFactory.new().make()
assert user.first_name  # populated from definition()
assert user.id is None  # not persisted
```

Override fields the same way as `create()`:

```python
user = await UserFactory.new().make(email="test@example.com")
```

### Creating Multiple Records

Chain `.count(n)` before `create()` or `make()` to produce a list of `n` instances:

```python
users = await UserFactory.new().count(10).create()
# returns a list of 10 User instances, each persisted

drafts = await UserFactory.new().count(5).make()
# returns a list of 5 User instances, not persisted
```

When `count()` is used the return value is always a list. Without `count()` a single instance is returned.

### States / Variations

A **state** applies a partial override on top of `definition()`. Define states as methods on the factory that call `self.state()` with a callback returning the fields to merge:

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

Chain a state method before calling `create()` or `make()`:

```python
user = await UserFactory.new().suspended().create()
assert user.account_status == "suspended"
```

Multiple states can be stacked — they are applied in order, each receiving the accumulated attributes:

```python
user = await UserFactory.new().suspended().count(3).create()
```

### Lifecycle Hooks

Use `configure()` to register callbacks that run after `make()` or `create()`:

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

`configure()` is called automatically by `Factory.new()`. It must return `self` (or the result of chaining `.after_making()` / `.after_creating()`).

### Relationships

`has()` creates a related factory record after the parent is saved. The foreign key is inferred automatically as `{parent_table_singular}_id`:

```python
# Create an organization and automatically create 3 contacts for it
org = await OrganizationFactory.new().has(ContactFactory.new().count(3)).create()
```

`for_()` creates the parent first and injects its id as a foreign key into the child:

```python
contact = await ContactFactory.new().for_(OrganizationFactory.new()).create()
```

### Complete Factory Example

```python
# databases/factories/ContactFactory.py
from faker import Faker
from fastapi_startkit.masoniteorm.factory import Factory
from app.models.Contact import Contact

fake = Faker()


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

Place seeder files in `databases/seeds/`. Extend `Seeder` and implement an `async run()` method:

```python
# databases/seeds/category_seeder.py
from fastapi_startkit.masoniteorm.seeds import Seeder
from app.models.category import Category


class CategorySeeder(Seeder):
    async def run(self):
        categories = ["Programming", "Web Development", "Data Science", "Design"]
        for name in categories:
            await Category.first_or_create({"name": name})
```

Using `first_or_create` makes seeders idempotent — running them multiple times will not create duplicate records.

### Combining Factories and Seeders

Factories and seeders work well together. Use factories inside a seeder to generate large volumes of varied data:

```python
# databases/seeds/database_seeder.py
from fastapi_startkit.masoniteorm.seeds import Seeder
from app.models.Account import Account
from app.models.User import User
from databases.factories.UserFactory import UserFactory
from databases.factories.OrganizationFactory import OrganizationFactory
from databases.factories.ContactFactory import ContactFactory
import random


class DatabaseSeeder(Seeder):
    async def run(self):
        # Create a root account
        account = await Account.create({"name": "Acme Corporation"})

        # Create a known admin user
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

        # Generate 5 random users with the factory
        await UserFactory.new().count(5).create(account_id=account.id)

        # Generate 100 organizations
        organizations = await OrganizationFactory.new().count(100).create(account_id=account.id)

        # Generate 100 contacts, each tied to a random organization
        for _ in range(100):
            await ContactFactory.new().create(
                account_id=account.id,
                organization_id=random.choice(organizations).id,
            )
```

### Orchestrating Seeders with `self.call()`

The `DatabaseSeeder` is the conventional entry point. Use `self.call()` to run other seeders in a defined order:

```python
# databases/seeds/database_seeder.py
from fastapi_startkit.masoniteorm.seeds import Seeder
from .category_seeder import CategorySeeder
from .user_seeder import UserSeeder
from .course_seeder import CourseSeeder


class DatabaseSeeder(Seeder):
    async def run(self):
        await self.call(CategorySeeder)
        await self.call(UserSeeder)
        await self.call(CourseSeeder)
```

`self.call()` runs each seeder and waits for it to complete before starting the next. Order matters when seeders have dependencies — categories must exist before courses that reference them.

### Running Seeders via Artisan

Run the `DatabaseSeeder` entry point:

```bash
uv run python artisan db:seed
```

Run a specific seeder class by name:

```bash
uv run python artisan db:seed --class UserSeeder
```

Use a fully qualified dotted path to target a seeder in a sub-directory:

```bash
uv run python artisan db:seed --class databases.seeds.user_seeder.UserSeeder
```

Specify a custom seed directory with `--directory`:

```bash
uv run python artisan db:seed --directory databases/seeds
```

### Generating a Seeder File

The `seed` artisan command scaffolds a new seeder file:

```bash
uv run python artisan seed Post
```

This creates `databases/seeds/post_table_seeder.py` with a `PostTableSeeder` stub:

```python
"""PostTableSeeder Seeder."""

from fastapi_startkit.masoniteorm.seeds import Seeder


class PostTableSeeder(Seeder):
    async def run(self):
        """Run the database seeds."""
        pass
```
