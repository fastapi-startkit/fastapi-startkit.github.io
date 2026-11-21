---
outline: deep
title: Model Factories
description: Generate models filled with fake data for tests and seeders in FastAPI Startkit.
keywords: orm, factory, factories, test data, fake data, faker, database, fastapi startkit
---

# Model Factories

A model factory builds models filled with fake data. Instead of writing every attribute by hand in each test, you describe a model's default attributes once and ask the factory for one, ten or a hundred records. Factories use [Faker](https://faker.readthedocs.io/), which is installed with the `database` extra.

- [Defining Factories](#defining-factories)
- [Creating Models](#creating-models)
- [Factory States](#factory-states)
- [Factory Callbacks](#factory-callbacks)
- [Factory Relationships](#factory-relationships)

## Defining Factories

Factories live in `databases/factories/`. A factory extends `Factory`, sets `model`, and returns the default attributes from `definition()`. Inside `definition()`, `self.fake` is a Faker instance:

```python
# databases/factories/user_factory.py
from fastapi_startkit.masoniteorm.factory import Factory

from app.models.User import User


class UserFactory(Factory):
    model = User

    def definition(self):
        return {
            "name": self.fake.name(),
            "email": self.fake.unique.email(),
            "password": "secret",
            "is_active": True,
        }
```

`definition()` runs once per model, so every record gets fresh values.

## Creating Models

Start every factory call with `new()`. To insert a record and get the saved model back, call `create()`:

```python
user = await UserFactory.new().create()

print(user.id)     # 1
print(user.email)  # a fake email such as "leah33@example.net"
```

To set specific attributes, pass them as keyword arguments. They replace the values from `definition()`:

```python
admin = await UserFactory.new().create(name="Admin", email="admin@example.com")
```

### Building Models Without Saving

`make()` builds the model in memory and doesn't touch the database. It accepts the same keyword arguments:

```python
user = await UserFactory.new().make(email="test@example.com")

user.is_created()  # False
```

### Creating Many Models

Call `count()` before `create()` or `make()` to get a list of models:

```python
users = await UserFactory.new().count(3).create()   # 3 saved users
drafts = await UserFactory.new().count(5).make()    # 5 unsaved users
```

Without `count()`, or with `count(1)`, you get a single model instead of a list.

## Factory States

A state is a named variation of the default attributes, such as a suspended user. Define it as a method that passes a callback to `self.state()`. The callback receives the attributes built so far and returns the ones to change:

```python
# databases/factories/user_factory.py
class UserFactory(Factory):
    model = User

    def definition(self):
        ...

    def suspended(self):
        return self.state(lambda attributes: {"is_active": False})

    def admin(self):
        return self.state(lambda attributes: {
            "role": "admin",
            "email": f"admin.{attributes['email']}",
        })
```

Call the state before `create()` or `make()`. States chain with each other and with `count()`, and they're applied in the order you call them:

```python
user = await UserFactory.new().suspended().create()
user.is_active  # False

admins = await UserFactory.new().suspended().admin().count(3).create()
```

Keyword arguments passed to `create()` or `make()` are applied last, so they win over any state.

## Factory Callbacks

To run code after a factory saves a model, register an `after_creating` callback in a `configure()` method. `new()` calls `configure()` for you:

```python
# databases/factories/user_factory.py
from app.models.Post import Post


class UserFactory(Factory):
    model = User

    def definition(self):
        ...

    def configure(self):
        return self.after_creating(self.create_welcome_post)

    async def create_welcome_post(self, user):
        await Post.create({
            "user_id": user.id,
            "title": f"Welcome, {user.name}",
            "content": "Thanks for joining.",
        })
```

`after_creating` callbacks run after each `create()`. `after_making` registers a callback the same way, but it runs only after `make()`, never after `create()`. Each callback receives the model and can be a regular or an async function.

## Factory Relationships

### Has Many

To create related records along with a model, pass another factory to `has()`. The related records are created after each parent is saved. These examples use a `PostFactory` for the `Post` model, defined the same way as `UserFactory`:

```python
user = await UserFactory.new().has(PostFactory.new().count(3)).create()
```

This creates a user and three posts. The foreign key is the singular form of the parent's table name followed by `_id`, so each post gets the user's id in `user_id`.

### Belongs To

To create the parent first, pass its factory to `for_()`. The parent's id is set on the new model with the same foreign key naming:

```python
post = await PostFactory.new().for_(UserFactory.new().suspended()).create()
```

The parent factory must create a single model, so don't call `count()` on it.

See [Seeds](/docs/database/seeds#using-model-factories) to use factories when you seed a database.
