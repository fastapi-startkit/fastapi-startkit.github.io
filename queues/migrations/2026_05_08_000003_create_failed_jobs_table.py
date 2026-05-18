"""CreateFailedJobsTable Migration."""

from fastapi_startkit.masoniteorm.migrations import Migration


class CreateFailedJobsTable(Migration):
    async def up(self):
        """Run the migrations."""
        async with await self.schema.create("failed_jobs") as table:
            table.id("id")
            table.string("uuid").unique()
            table.text("connection")
            table.text("queue")
            table.long_text("payload")
            table.long_text("exception")
            table.timestamp("failed_at")

    async def down(self):
        """Revert the migrations."""
        await self.schema.drop("failed_jobs")