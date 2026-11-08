---
outline: deep
title: Browser Testing
description: Drive your application in a real browser with fluent, async Playwright tests.
keywords: browser testing, playwright, end-to-end, inertia, pytest, truncation
---

# Browser Testing

`HttpTestCase` sends requests straight to your ASGI app, so it never runs your frontend, follows a client-side Inertia visit, or fills in a form. Browser tests do. FastAPI Startkit starts your application on a live server, opens it in Chromium, Firefox or WebKit through [Playwright](https://playwright.dev/python/), and gives you a fluent chain that reads like a user's script:

```python
from fastapi_startkit.playwright import visit


class TestLogin(TestCase, DatabaseTruncation):
    async def test_user_can_sign_in(self) -> None:
        await UserFactory.new().create(email="ada@example.com", password="password")

        await (
            visit("/login")
            .fill("email", "ada@example.com")
            .fill("password", "password")
            .click("submit")
            .assert_path_is("/dashboard")
        )
```

The test, the live server, Playwright and your database connections all share one event loop, so you can `await` the ORM and factories directly before and after a chain.

## Installation

Install the `playwright` extra as a dev dependency. It brings in `playwright` and `pytest-asyncio` on top of the `fastapi` extra. Then download the browsers you plan to use:

```bash
uv add --dev "fastapi-startkit[playwright]"
uv run playwright install chromium
```

Run `uv run playwright install` with no argument to fetch Chromium, Firefox and WebKit together.

The pytest plugin registers itself through an entry point. It only loads when both `playwright` and `pytest-asyncio` are installed, so projects without the extra see no new options or hooks.

Set up pytest the same way as for other async tests. Setting the default fixture loop scope to `session` lets your own async fixtures run on the loop the browser tests use:

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "session"
pythonpath = ["."]
testpaths = ["tests"]
```

If you'd rather keep a different default, declare each async fixture that browser tests use with `@pytest_asyncio.fixture(loop_scope="session")`.

## Writing Browser Tests

### `BrowserTestCase`

Browser tests extend `BrowserTestCase` and return your application from `get_application()`. A small base class keeps that in one place:

```python
# tests/browser/test_case.py
from fastapi_startkit.playwright import BrowserTestCase


class TestCase(BrowserTestCase):
    def get_application(self):
        from bootstrap.application import app

        return app
```

Before each test, `BrowserTestCase` serves that application with uvicorn on a free port on `127.0.0.1`. The server is reused for the rest of the session and restarts only if a test returns a different application. Every page gets its own browser context with `base_url` pointing at the server, so you pass paths such as `"/login"` rather than full URLs.

Test methods must be `async def`. A sync test method fails with a message asking you to declare it with `async def`, because browser tests run on the session event loop.

### Page Chains

`visit(path)` returns a page without opening anything. Each interaction or assertion you chain records a step and returns the page. When you `await` the page, it opens the browser, navigates to the path, and runs the steps in order:

```python
from fastapi_startkit.playwright import visit

from .test_case import TestCase


class TestHome(TestCase):
    async def test_home_page_welcomes_visitors(self) -> None:
        await visit("/").assert_see("Welcome")
```

If a step fails, the steps after it are dropped and the test fails with an `AssertionError`.

::: warning Always await the chain
A chain that is never awaited would test nothing. If a page was never awaited, or still has recorded steps when the test ends, the test errors at teardown, provided it otherwise passed, with `visit("/") was never awaited, so its steps did not run.` A bare `visit("/")` counts too.
:::

You can await the same page again after adding more steps, and keep querying the database in between:

```python
page = await visit("/register").fill("name", "Ada").click("Create account")

user = await User.where("name", "Ada").first()
assert user is not None

await page.assert_see(f"Welcome back, {user.name}")
```

### Choosing a Browser and Device

Configure the page before its first step runs. Configuring a page after it has opened raises `RuntimeError`.

```python
await visit("/").firefox().assert_see("Welcome")
await visit("/").on().mobile().assert_see("Welcome")
await visit("/").on().tablet().webkit().assert_see("Welcome")
```

| Method | Effect |
|---|---|
| `.chromium()`, `.firefox()`, `.webkit()` | Choose the browser engine; `.browser("firefox")` does the same by name |
| `.on().mobile()` | Emulate an `iPhone 14` |
| `.on().tablet()` | Emulate an `iPad (gen 7)` |
| `.on().desktop()` | No device emulation, the default |
| `.on().device("Pixel 7")` or `.device("Pixel 7")` | Emulate any device in Playwright's device list |
| `.with_timezone("Asia/Kathmandu")` | Set the context's timezone |
| `.with_locale("fr-FR")` | Set the context's locale |
| `.with_user_agent("...")` | Set the user agent |

Timezone, locale and user agent are applied over the device descriptor, so an explicit user agent wins. Firefox doesn't support `is_mobile`, so for Firefox that flag is dropped while the device's viewport, user agent and touch support are kept. An unknown browser or device name raises `ValueError`.

Pages use the `browser_default` ini option when a test doesn't choose a browser. See [Configuration](#configuration).

## Finding Elements

You target elements by what a user sees, not by CSS selectors. Each method looks in a few places and combines the candidates, so Playwright still waits for the element to appear:

| What | Found by | Used by |
|---|---|---|
| Buttons and links | accessible name, `id`, `name` or `type` | `click`, `press`, `press_and_wait_for`, `assert_button_enabled`, `assert_button_disabled` |
| Form controls | label, `name`, `id` or placeholder | `fill`, `type`, `check`, `select`, `attach`, `value`, `assert_value`, and the other form methods |
| Elements | a CSS or XPath selector; `@name` is shorthand for `[data-testid="name"]` | element assertions, `hover`, `drag`, `text`, `attribute`, `within_frame` |
| Radios | group name and value | `radio`, `assert_radio_selected`, `assert_radio_not_selected` |

Because buttons match on `type`, `click("submit")` presses the form's submit button. A target that starts with `#`, `.`, `[`, `//`, `css=`, `xpath=` or `text=` is always treated as a selector:

```python
await (
    visit("/login")
    .fill("Email address", "ada@example.com")
    .fill("#password", "password")
    .click("Sign in")
    .assert_visible("@flash-message")
)
```

## Interacting with the Page

### Clicking

| Method | What it does |
|---|---|
| `click(target)` | Click a button or link |
| `press(target)` | Same as `click` |
| `press_and_wait_for(target, seconds=5)` | Click, then wait up to `seconds` for the button to be enabled again |

### Typing

| Method | What it does |
|---|---|
| `fill(field, value)` | Replace the field's value |
| `type(field, value)` | Clear the field, then type key by key |
| `type_slowly(field, value, delay=100)` | Like `type`, with `delay` milliseconds between keys |
| `append(field, value)` | Type at the end of the current value |
| `clear(field)` | Empty the field |
| `keys(field, *keys)` | Send keys: plain text is typed, `{Enter}` is a named key, and a list is a chord |
| `with_key_down(key, callback)` | Hold `key` while the callback's steps run |

```python
await (
    visit("/search")
    .keys("query", "fastapi", "{Enter}")
    .keys("notes", ["ControlOrMeta", "a"], "{Backspace}")
    .with_key_down("Shift", lambda page: page.click("Item 3"))
)
```

### Choosing

| Method | What it does |
|---|---|
| `select(field, option)` | Choose an option, or a list of options for a multiple select |
| `radio(name, value)` | Choose the radio button with that group name and value |
| `check(field)` / `uncheck(field)` | Tick or untick a checkbox |
| `attach(field, path)` | Set a file input to a path, or a list of paths |

### Pointer, Forms and Navigation

| Method | What it does |
|---|---|
| `hover(selector)` | Move the pointer over an element |
| `drag(source, target)` | Drag one element onto another |
| `submit()` | Submit the focused element's form, or the first form on the page |
| `within_frame(selector, callback)` | Run the callback's steps inside an iframe |
| `resize(width, height)` | Change the viewport size |
| `navigate(path)` | Go to another path in the same page |

The callbacks of `with_key_down` and `within_frame` receive the page and add steps that run in place. They may also be `async`. Inside `within_frame`, element lookups are scoped to the frame, while URL and console assertions still read the top page:

```python
await (
    visit("/checkout")
    .within_frame("#payment", lambda frame: frame.fill("card", "4242 4242 4242 4242"))
    .click("Pay")
)
```

### Waiting

| Method | What it does |
|---|---|
| `wait(seconds)` | Pause for a fixed time |
| `wait_for_text(text)` | Wait until the text appears on the page |
| `wait_for_key()` | Wait until you press a key in the browser, handy in a headed run |

You rarely need these. Every action waits for its element, and every assertion retries until the timeout.

### Reading Values

Some methods return a value instead of the page. They are coroutines that run any pending steps first:

```python
page = visit("/profile").fill("name", "Ada")

assert await page.value("name") == "Ada"
assert await page.text("h1") == "Your profile"
assert await page.attribute("@avatar", "alt") == "Ada"
assert await page.script("document.title") == "Profile"
html = await page.content()
```

`script(expression, argument=None)` evaluates JavaScript in the page. Once a page has been awaited, `page.playwright` is the underlying Playwright `Page` for anything the chain doesn't cover. Using it before the page has been awaited raises `RuntimeError`. `page.url` and `page.path` read the current location.

## Available Assertions

Every assertion except the [console checks](#source-and-scripts) retries until the [timeout](#configuration). Failures name the target and the expectation, and usually the current path, for example `Expected to see "Welcome" on /login.` Title and URL assertions show the actual title or URL instead.

### Title and Text

| Assertion | Passes when |
|---|---|
| `assert_title(title)` | The page title equals `title` |
| `assert_title_contains(text)` | The page title contains `text` |
| `assert_see(text)` / `assert_dont_see(text)` | The page's rendered text contains, or doesn't contain, `text` |
| `assert_see_in(selector, text)` / `assert_dont_see_in(selector, text)` | The element's rendered text contains, or doesn't contain, `text` |
| `assert_see_anything_in(selector)` | The element has some visible text |
| `assert_see_nothing_in(selector)` | The element has no visible text |
| `assert_see_link(text)` / `assert_dont_see_link(text)` | A visible link containing `text` exists, or no visible link containing `text` exists |

Text comparisons are case-sensitive and read the rendered text, so hidden elements don't count. `assert_dont_see_in` first requires the selector to match, so a typo in the selector fails instead of passing quietly.

### Source and Scripts

| Assertion | Passes when |
|---|---|
| `assert_source_has(html)` / `assert_source_missing(html)` | The page's HTML contains, or doesn't contain, `html` |
| `assert_script(expression, expected=True)` | The JavaScript expression returns `expected` |

### Elements

| Assertion | Passes when |
|---|---|
| `assert_count(selector, count)` | Exactly `count` elements match |
| `assert_visible(selector)` | The element is visible |
| `assert_present(selector)` | The element is in the DOM, visible or not |
| `assert_not_present(selector)` | No element matches |
| `assert_missing(selector)` | The element is hidden or not in the DOM |

### Attributes

| Assertion | Passes when |
|---|---|
| `assert_attribute(selector, name, value)` | The attribute equals `value` |
| `assert_attribute_missing(selector, name)` | The element exists without the attribute |
| `assert_attribute_contains(selector, name, value)` | The attribute contains `value` |
| `assert_attribute_doesnt_contain(selector, name, value)` | The attribute exists and doesn't contain `value` |
| `assert_aria_attribute(selector, name, value)` | `aria-{name}` equals `value` |
| `assert_data_attribute(selector, name, value)` | `data-{name}` equals `value` |

### Form State

| Assertion | Passes when |
|---|---|
| `assert_value(field, value)` / `assert_value_is_not(field, value)` | The field's value equals, or doesn't equal, `value` |
| `assert_checked(field)` / `assert_not_checked(field)` | The checkbox is ticked, or not |
| `assert_indeterminate(field)` | The checkbox is indeterminate |
| `assert_radio_selected(name, value)` | The radio with that value is chosen |
| `assert_radio_not_selected(name, value=None)` | That radio isn't chosen; without a value, no radio in the group is |
| `assert_selected(field, value)` / `assert_not_selected(field, value)` | The select has, or doesn't have, `value` selected |
| `assert_enabled(field)` / `assert_disabled(field)` | The form control is enabled, or disabled |
| `assert_button_enabled(target)` / `assert_button_disabled(target)` | The button is enabled, or disabled |

### URL

| Assertion | Passes when |
|---|---|
| `assert_url_is(url)` | The URL matches; a path such as `"/login"` is resolved against the live server |
| `assert_path_is(path)` / `assert_path_is_not(path)` | The path matches, or doesn't |
| `assert_path_begins_with(prefix)`, `assert_path_ends_with(suffix)`, `assert_path_contains(text)` | The path starts with, ends with, or contains the text |
| `assert_scheme_is(scheme)` / `assert_scheme_is_not(scheme)` | The scheme matches, or doesn't |
| `assert_host_is(host)` / `assert_host_is_not(host)` | The host matches, or doesn't |
| `assert_port_is(port)` / `assert_port_is_not(port)` | The port matches, or doesn't; without an explicit port, the scheme's default is used |
| `assert_query_string_has(name, value=None)` | The query string has `name`, set to `value` if given |
| `assert_query_string_missing(name)` | The query string doesn't have `name` |
| `assert_fragment_is(fragment)` / `assert_fragment_is_not(fragment)` | The fragment matches, or doesn't |
| `assert_fragment_begins_with(prefix)` | The fragment starts with `prefix` |

`assert_url_is` and `assert_path_is` ignore the query string and fragment.

### Console

| Assertion | Passes when |
|---|---|
| `assert_no_console_logs()` | The page logged nothing to the console |
| `assert_no_javascript_errors()` | The page threw no uncaught errors |
| `assert_no_smoke()` | Both of the above |

These don't retry: they wait for the page's `load` event once, then list anything the page recorded. `assert_no_smoke()` is a quick check that a page renders cleanly:

```python
async def test_pages_render_cleanly(self) -> None:
    for path in ["/", "/login", "/register"]:
        await visit(path).assert_no_smoke()
```

::: tip Firefox console warnings
Firefox also reports browser warnings as console messages, such as the quirks-mode warning for a page without `<!DOCTYPE html>`. A page can therefore pass `assert_no_smoke()` on Chromium and fail it on Firefox. Fix the warning, or use `assert_no_javascript_errors()` if you only care about errors.
:::

## Resetting the Database

`RefreshDatabase` rolls back a transaction after each test, but the live server writes through its own connections, so that rollback can't undo what happens during a browser test. Use `DatabaseTruncation` instead:

```python
from fastapi_startkit.masoniteorm.testing import DatabaseTruncation
from fastapi_startkit.playwright import visit

from app.models.user import User
from .test_case import TestCase


class TestRegistration(TestCase, DatabaseTruncation):
    async def test_new_user_can_create_an_account(self) -> None:
        await (
            visit("/register")
            .fill("name", "Ada Lovelace")
            .fill("email", "ada@example.com")
            .fill("password", "analytical-engine")
            .click("Create account")
            .assert_url_is("/dashboard")
        )

        user = await User.where("email", "ada@example.com").first()
        assert user is not None
```

The first test in the process runs `migrate:fresh` once for each connection and migration directory. Before every later test, it empties every table except `migrations` and SQLite's internal `sqlite_*` tables. On Postgres this is a single `TRUNCATE ... RESTART IDENTITY CASCADE`; MySQL, SQLite and SQL Server use each platform's foreign-key-safe truncate. After the reset it runs your `DatabaseSeeder`.

You can tune it with class attributes:

| Attribute | Default | Purpose |
|---|---|---|
| `connection` | `None` (the default connection) | Connection to migrate and truncate |
| `migration_directory` | `"databases/migrations"` | Migrations to run, relative to the application's base path |
| `except_tables` | `[]` | Extra tables to keep |
| `tables_to_truncate` | `None` | Empty only these tables instead of every table |
| `seed` | `True` | Set to `False` to skip seeding. Ignored when `seeder` is set |
| `seeder` | `None` | Class name of the seeder to run instead of `DatabaseSeeder`, as a string such as `"ReportSeeder"` |
| `seed_directory` | `"databases/seeders"` | Where seeders are loaded from |

```python
class TestReports(TestCase, DatabaseTruncation):
    except_tables = ["countries"]
    seeder = "ReportSeeder"
```

`DatabaseTruncation` hooks into `asyncStartTestRun`, so you can also use it in a regular `HttpTestCase` when you want the same reset there.

## Running Browser Tests

Browser tests run with plain pytest:

```bash
uv run pytest tests/browser
```

| Option | Effect |
|---|---|
| `--headed` | Show the browser windows |
| `--inspect` | Run headed and, when a test fails, pause each of its open pages in the Playwright inspector |

`--headed` is shared with `pytest-playwright` if that plugin is installed too. pytest's own `--debug` is left alone.

### Debugging a Single Test

Add `.debug()` to a chain to pause there in the Playwright inspector:

```python
await visit("/login").fill("email", "ada@example.com").debug().click("submit")
```

When any `BrowserTestCase` test calls `.debug()`, pytest runs only those tests, headed. Calls named `debug()` outside browser test classes, such as `logger.debug()`, don't affect test selection.

`.screenshot(full_page=False, filename=None)` saves a screenshot at any point in a chain. It is named after the test unless you pass a filename.

### Failure Screenshots

When a browser test fails, every page it opened is captured as a full-page screenshot in the screenshot directory, and the path is attached to pytest's report under "Browser screenshot". Add the directory to `.gitignore`.

### Configuration

Set these ini options in `pyproject.toml`:

| Option | Default | Purpose |
|---|---|---|
| `browser_default` | `chromium` | Browser used when a test doesn't choose one |
| `browser_timeout` | `5000` | Milliseconds actions and assertions wait |
| `browser_screenshot_dir` | `tests/browser/screenshots` | Where screenshots are saved, relative to the pytest rootdir |

```toml
[tool.pytest.ini_options]
browser_default = "firefox"
browser_timeout = "10000"
```

## Example Application

The framework repository includes [`example/browser-testing`](https://github.com/fastapi-startkit/fastapi-startkit-framework/tree/v0.75.0/example/browser-testing), an Inertia and Vue app with register, login, logout and a guarded dashboard. Its tests under `tests/browser/` use `UserFactory`, `DatabaseTruncation` and direct ORM queries alongside page chains, and they're a good template for your own:

```bash
cd example/browser-testing
npm install && npm run build
uv sync
uv run playwright install chromium firefox
uv run pytest
```

## Not Yet Available

Accessibility checks and screenshot comparison assertions aren't available yet. An `assert_authenticated` assertion is planned for the auth package.
