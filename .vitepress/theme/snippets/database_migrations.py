from fastapi_startkit.masoniteorm import Migration

# Explicit schema design: MasoniteORM requires you to write your
# migrations manually rather than auto-generating them from
# code models (like Django or Alembic do). 
class CreateUsersTable(Migration):
    async def up(self):
        async with await self.schema.create("users") as table:
            table.increments("id")
            table.string("name")
            table.string("email").unique()
            table.string("password")
            table.timestamps()

    async def down(self):
        await self.schema.drop("users")

# Run `uv run python artisan db:migrate` to apply this migration.
