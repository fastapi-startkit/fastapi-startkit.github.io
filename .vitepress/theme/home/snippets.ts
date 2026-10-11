import type { Lang } from "./highlight"

export const heroFiles = [
    {
        tab: "Application",
        path: "bootstrap/application.py",
        code: `from pathlib import Path
from fastapi_startkit import Application
from fastapi_startkit.logging import LogProvider

app = Application(
    base_path=Path(__file__).parent.parent,
    providers=[LogProvider],
)

# .env loaded, providers registered and booted`,
    },
    {
        tab: "Routes",
        path: "routes/api.py",
        code: `from fastapi_startkit.fastapi import Router
from app.controllers import posts_controller, users_controller

router = Router()

router.resource("users", users_controller)
router.resource("posts", posts_controller, only={"index", "show"})`,
    },
    {
        tab: "MCP",
        path: "app/mcp/shop_server.py",
        code: `from fastapi_startkit.mcp import Server
from app.mcp.tools import RefundOrder, SummarizeOrders

class ShopServer(Server):
    name = "shop"

    def tools(self):
        return [SummarizeOrders, RefundOrder]

app.include_router(ShopServer().router(prefix="/mcp"))`,
    },
    {
        tab: "Logging",
        path: "app/services/payments.py",
        code: `from fastapi_startkit.logging import Logger

Logger.info("Payment captured")
Logger.warning("Retrying webhook delivery")
Logger.error("Card declined")

# LOG_CHANNEL=stack fans out to daily + terminal`,
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
        note: "Eloquent → Masonite ORM: models, query builder, migrations",
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
    __fillable__ = ["status"]



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
