"""CreateJobBatchesTable Migration."""

from fastapi_startkit.masoniteorm.migrations import Migration


class CreateJobBatchesTable(Migration):
    async def up(self):
        """Run the migrations."""
        async with await self.schema.create("job_batches") as table:
            table.string("id").primary()
            table.string("name")
            table.integer("total_jobs")
            table.integer("pending_jobs")
            table.integer("failed_jobs")
            table.long_text("failed_job_ids")
            table.text("options").nullable()
            table.integer("cancelled_at").nullable()
            table.integer("created_at")
            table.integer("finished_at").nullable()

    async def down(self):
        """Revert the migrations."""
        await self.schema.drop("job_batches")