import type { Lang } from "./highlight"

export type HeroFile = { name: string, path: string, code: string }
export type HeroTab = { tab: string, files: HeroFile[] }

export const heroTabs: HeroTab[] = [
    {
        tab: "Database",
        files: [
            {
                name: "application.py",
                path: "bootstrap/application.py",
                code: `from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.logging import LogProvider
from fastapi_startkit.masoniteorm import DatabaseProvider

# FastAPI Startkit ships with a fully async MasoniteORM provider.
# Use it for an elegant, Active Record workflow—or completely swap it
# for SQLAlchemy, SQLModel, or any async database stack you prefer.
app: Application = Application(
    base_path=Path(__file__).parent.parent,
    providers=[
        LogProvider,
        FastAPIProvider,
        DatabaseProvider,
    ]
)`,
            },
            {
                name: "create_users.py",
                path: "databases/migrations/2026_04_26_110113_create_users.py",
                code: `from fastapi_startkit.masoniteorm import Migration

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

# Run \`uv run python artisan db:migrate\` to apply this migration.`,
            },
            {
                name: "models.py",
                path: "app/models.py",
                code: `from fastapi_startkit.masoniteorm import Model, HasMany

class User(Model):
    id: int
    name: str
    email: str
    password: str

    posts: list["Post"] = HasMany("Post")

class Post(Model):
    id: int
    user_id: int
    title: str
    content: str

user = await User.find(1)
user_with_posts = await User.with_("posts").find(1)`,
            },
        ],
    },
    {
        tab: "Log",
        files: [
            {
                name: "application.py",
                path: "bootstrap/application.py",
                code: `from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.logging import LogProvider

app: Application = Application(
    base_path=Path(__file__).parent.parent,
    providers=[LogProvider],
)`,
            },
            {
                name: "logging.py",
                path: "app/services/logging.py",
                code: `from fastapi_startkit.logging import Logger

# Once LogProvider is registered in bootstrap/application.py,
# the global Logger is accessible anywhere in your codebase.
# No local instantiation or repetitive configuration is required.

Logger.debug("This is a debug message")
Logger.info("Application is starting...")
Logger.notice("A formal notice")
Logger.warning("Unusual activity detected")
Logger.error("An error occurred during processing")
Logger.critical("System failure!")
Logger.alert("Immediate action required")
Logger.emergency("System is unusable")`,
            },
        ],
    },
    {
        tab: "MCP",
        files: [
            {
                name: "application.py",
                path: "bootstrap/application.py",
                code: `from fastapi_startkit import Application
from fastapi_startkit.fastapi import FastAPIProvider
from fastapi_startkit.mcp import McpProvider
from app.mcp.server import ShopServer

app = Application(providers=[FastAPIProvider, McpProvider])

app.include_router(ShopServer().router(prefix="/mcp"))`,
            },
            {
                name: "server.py",
                path: "app/mcp/server.py",
                code: `from fastapi_startkit.mcp import Server
from app.mcp.tools import AddTool

class ShopServer(Server):
    name = "shop"
    description = "Shop MCP server"
    instructions = "Call tools/list to see available tools."

    def tools(self):
        return [AddTool]`,
            },
            {
                name: "tools.py",
                path: "app/mcp/tools.py",
                code: `from pydantic import BaseModel
from fastapi_startkit.mcp import Tool, Response

class AddInput(BaseModel):
    a: int
    b: int

class AddTool(Tool):
    name = "add"
    description = "Add two integers and return the result."

    def schema(self) -> type[BaseModel]:
        return AddInput

    async def handle(self, arguments: dict) -> Response:
        result = arguments.get("a", 0) + arguments.get("b", 0)
        return Response.text(str(result))`,
            },
        ],
    },
    {
        tab: "Testing",
        files: [
            {
                name: "router_agent.py",
                path: "app/agents/router_agent.py",
                code: `from fastapi_startkit.ai import Agent, provider, model

@provider("openai")
@model("gpt-4o")
class RouterAgent(Agent):
    def instructions(self) -> str:
        return "Greet the user and suggest relevant jobs."

    def tools(self):
        return [job_search_tool]`,
            },
            {
                name: "test_router_agent.py",
                path: "tests/test_router_agent.py",
                code: `from unittest import IsolatedAsyncioTestCase
from app.agents.router_agent import RouterAgent

class TestRouterAgent(IsolatedAsyncioTestCase):
    async def test_the_router_agent(self):
        with RouterAgent.record("record_stream.json") as agent:
            await agent.prompt("hello")
            agent.assert_text_response()
            agent.assert_tool_not_called(["job_search_tool"])
            await agent.assert_response_judged(
                model="gpt-4o-mini",
                expectation="The llm should respond with greetings",
            )

            await agent.prompt("suggest python developer jobs")
            agent.assert_tool_called("job_search_tool")`,
            },
        ],
    },
]

export const mcpToolSnippet = `class SummarizeOrders(Tool):
    name = "summarize_orders"
    description = "Summarize the orders for a day."

    def schema(self):
        return DayInput

    async def handle(self, arguments: dict) -> Response:
        day = arguments["date"]
        orders = await Order.where("date", day).get()
        return Response.text(f"{orders.count()} orders")`

export const agentTestSnippet = `from unittest import IsolatedAsyncioTestCase
from app.agents import SupportAgent

class TestSupportAgent(IsolatedAsyncioTestCase):
    async def test_refund_request(self):
        with SupportAgent.record("refund.json") as agent:
            await agent.prompt("Refund order #1042")

            agent.assert_tool_called("lookup_order")
            await agent.assert_response_judged(
                expectation="Confirms the refund politely",
            )`

export type Comparison = {
    tab: string
    note: string
    lang: Lang
    laravel: { path: string, code: string }
    startkit: { path: string, code: string }
}

export const comparisons: Comparison[] = [
    {
        tab: "Models",
        note: "Eloquent → Masonite ORM: $fillable becomes typed attributes",
        lang: "python",
        laravel: {
            path: "app/Models/Order.php",
            code: `class Order extends Model
{
    protected $fillable = ['status'];
}

Order::where('status', 'paid')->get();`,
        },
        startkit: {
            path: "app/models/order.py",
            code: `class Order(Model):
    __table__ = "orders"

    id: int
    status: str

await Order.where("status", "paid").get()`,
        },
    },
    {
        tab: "Routes",
        note: "Route facade → Router: get, post, resource() with only / excepts",
        lang: "python",
        laravel: {
            path: "routes/web.php",
            code: `Route::get('/', [HomeController::class, 'index']);

Route::resource('users', UserController::class);`,
        },
        startkit: {
            path: "routes/web.py",
            code: `router.get("/", home_controller.index)

router.resource("users", UsersController)`,
        },
    },
    {
        tab: "Artisan",
        note: "php artisan → python artisan, built on Cleo",
        lang: "bash",
        laravel: {
            path: "terminal",
            code: `php artisan make:model Order
php artisan make:migration create_orders_table
php artisan migrate
php artisan db:seed`,
        },
        startkit: {
            path: "terminal",
            code: `python artisan db:make:model Order
python artisan db:make:migration create_orders_table
python artisan db:migrate
python artisan db:seed`,
        },
    },
    {
        tab: "Providers",
        note: "ServiceProvider → Provider: register() then boot(), same two phases",
        lang: "python",
        laravel: {
            path: "app/Providers/BillingServiceProvider.php",
            code: `class BillingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton('billing', Billing::class);
    }
}`,
        },
        startkit: {
            path: "app/providers/billing_provider.py",
            code: `class BillingProvider(Provider):
    def register(self):
        self.app.singleton("billing", Billing)`,
        },
    },
]
