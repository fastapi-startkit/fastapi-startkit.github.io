"""CreateJobsTable Migration."""

from fastapi_startkit.masoniteorm.migrations import Migration


class CreateJobsTable(Migration):
    async def up(self):
        """Run the migrations."""
        async with await self.schema.create("jobs") as table:
            table.id("id")
            table.string("queue").index()
            table.long_text("payload")
            table.small_integer("attempts").unsigned()
            table.unsigned_integer("reserved_at").nullable()
            table.unsigned_integer("available_at")
            table.unsigned_integer("created_at")

    async def down(self):
        """Revert the migrations."""
        await self.schema.drop("jobs")