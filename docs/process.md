---
outline: deep
title: Process
description: Run shell commands, pipelines and concurrent processes with the Process class, and fake them in tests.
keywords: process, subprocess, shell, commands, async, pipes, pools, testing, fastapi startkit
---

# Process

The `Process` class runs shell commands from your application: a build step, a `git` command or a backup script. You can `await` a command inside a route, run one synchronously from a script, stream the output of a long-running process, build pipelines and run several commands at once. In tests, you can fake every command so nothing actually runs.

- [Running Processes](#running-processes)
- [Process Options](#process-options)
- [Running Processes Synchronously](#running-processes-synchronously)
- [Piping Processes](#piping-processes)
- [Running Processes in the Background](#running-processes-in-the-background)
- [Running Processes Concurrently](#running-processes-concurrently)
- [Handling Errors](#handling-errors)
- [Testing](#testing)

## Running Processes

To run a command, pass it to `Process.run()` and `await` the result. The command runs through the shell, so pipes, redirects and environment variables work as they do in a terminal:

```python
from fastapi_startkit.process import Process

result = await Process.run("git rev-parse --short HEAD")

print(result.output())     # "3f2a1c9\n"
print(result.exit_code())  # 0
```

`run()` returns a `ProcessResult`. Use `successful()` and `failed()` to branch on the exit code:

```python
result = await Process.run("git status")

if result.successful():
    print(result.output())

if result.failed():
    print(result.error_output())
```

### Inspecting the Result

A `ProcessResult` gives you the following methods:

| Method | Description |
|---|---|
| `output()` | Captured stdout |
| `error_output()` | Captured stderr |
| `error()` | Same as `error_output()` |
| `output_json()` | stdout parsed as JSON |
| `exit_code()` | The exit code |
| `successful()` | `True` when the exit code is `0` |
| `failed()` | `True` when the exit code is not `0` |
| `throw()` | Raises `ProcessFailedException` when the process failed, otherwise returns the result |
| `throw_if(condition)` | Calls `throw()` only when `condition` is truthy |
| `command()` | The command that ran |

When a command prints JSON, `output_json()` parses stdout for you. It raises `json.JSONDecodeError` when stdout isn't valid JSON:

```python
result = await Process.run("cat package.json")

package = result.output_json()
print(package["name"])
```

## Process Options

Before you run a command, you may chain options onto `Process`. Each option returns a `PendingProcess`, so you can chain as many as you need and finish with `run()`:

```python
result = await (
    Process
    .timeout(30)
    .path("/var/www/app")
    .env({"APP_ENV": "staging"})
    .run("bash deploy.sh")
)
```

| Option | Description |
|---|---|
| `timeout(seconds)` | Kills the process and raises `ProcessTimedOutException` after this many seconds. The default is 60. |
| `forever()` | Removes the timeout. |
| `quietly()` | Discards stdout and stderr. `output()` and `error_output()` return empty strings. |
| `tty(enabled=True)` | Connects the process to your terminal. Output is not captured. |
| `env(variables)` | Adds environment variables on top of the current environment. |
| `path(directory)` | Sets the working directory. |
| `input(data)` | Writes a string to the process's stdin. |

For example, `input()` sends text to a command that reads from stdin:

```python
result = await Process.input("taylor@example.com\n").run("wc -l")

print(result.output().strip())  # "1"
```

## Running Processes Synchronously

Outside an event loop, such as in a plain script or a synchronous console command, use `run_sync()`. It accepts the same options and returns the same `ProcessResult`:

```python
from fastapi_startkit.process import Process

result = Process.timeout(10).run_sync("python --version")

print(result.output())  # "Python 3.12.8\n", for example
```

To stream output while a synchronous command runs, pass a callback. It receives the stream name (`"stdout"` or `"stderr"`) and each line:

```python
def on_output(kind, line):
    print(f"[{kind}] {line}", end="")

result = Process.run_sync("npm run build", callback=on_output)
```

## Piping Processes

To feed one command's output into the next, use `Process.pipe()`. The callback receives a `Pipe` builder; call `command()` once for each stage. The stages are joined with `|` and run as a single shell command:

```python
result = await Process.pipe(lambda pipe: (
    pipe.command("cat storage/logs/app.log"),
    pipe.command('grep "ERROR"'),
    pipe.command("wc -l"),
))

print(result.output().strip())  # number of ERROR lines
```

Options chained before `pipe()` apply to the whole pipeline, and `pipe_sync()` runs a pipeline without an event loop:

```python
result = Process.path("/var/www/app").pipe_sync(lambda pipe: (
    pipe.command('find . -name "*.py"'),
    pipe.command("wc -l"),
))
```

## Running Processes in the Background

`Process.start()` launches a command without waiting for it and returns an `InvokedProcess`. The optional callback receives each line of output as it arrives:

```python
import time

from fastapi_startkit.process import Process


def on_output(kind, line):
    print(f"[{kind}] {line}", end="")


process = Process.timeout(300).start("bash build.sh", callback=on_output)

while process.running():
    process.ensure_not_timed_out()
    time.sleep(0.5)

result = process.wait()
print(result.exit_code())
```

`start()` reads output on background threads and `wait()` blocks the calling thread, so use it in scripts and console commands. Inside a route, use `await Process.run()`.

An `InvokedProcess` gives you the following methods:

| Method | Description |
|---|---|
| `running()` | `True` while the process is still executing |
| `pid()` | The process ID |
| `wait()` | Blocks until the process finishes and returns a `ProcessResult` |
| `kill()` | Kills the process immediately |
| `signal(sig)` | Sends a signal, such as `signal.SIGTERM` |
| `ensure_not_timed_out()` | Kills the process and raises `ProcessTimedOutException` once the timeout has elapsed |

## Running Processes Concurrently

To run several independent commands at once, use `Process.pool()`. Add the commands in the callback, call `start()` to launch them all, then call `wait()` to collect the results in the order you added them:

```python
results = Process.pool(lambda pool: (
    pool.command("bash export-users.sh"),
    pool.command("bash export-orders.sh"),
    pool.command("bash export-invoices.sh"),
)).start().wait()

for result in results:
    print(result.command(), result.exit_code())

if results.successful():
    print("All exports finished")
```

The returned `PoolResults` supports indexing, iteration, `len()`, `successful()` and `failed()`. Options chained before `pool()`, such as `timeout()` and `env()`, apply to every command in the pool.

To give a command its own working directory, call `path()` before `command()`:

```python
results = Process.pool(lambda pool: (
    pool.path("/srv/billing").command("npm test"),
    pool.path("/srv/storefront").command("npm test"),
)).start().wait()
```

To stream output, pass a callback to `start()`. It receives the stream name, the line and the command's position in the pool:

```python
def on_output(kind, line, index):
    print(f"[{index}] {line}", end="")

results = Process.pool(lambda pool: (
    pool.command("bash export-users.sh"),
    pool.command("bash export-orders.sh"),
)).start(callback=on_output).wait()
```

## Handling Errors

A failed command doesn't raise on its own. To stop when a command fails, call `throw()` on the result. It raises `ProcessFailedException`, which holds the result on `.result`:

```python
from fastapi_startkit.process import Process
from fastapi_startkit.process.exception import ProcessFailedException

try:
    (await Process.run("bash migrate.sh")).throw()
except ProcessFailedException as e:
    print(e.result.exit_code())
    print(e.result.error_output())
```

When a command runs past its timeout, the process is killed and `ProcessTimedOutException` is raised. The command is available on `.command`:

```python
from fastapi_startkit.process.exception import ProcessTimedOutException

try:
    await Process.timeout(5).run("sleep 60")
except ProcessTimedOutException as e:
    print(f"Timed out: {e.command}")
```

## Testing

Call `Process.fake()` to stop commands from running in your tests. While the fake is active, `run()`, `run_sync()`, `pipe()` and `pipe_sync()` record each command and return a successful, empty result. `start()` raises `NotImplementedError`, and pools still start real processes.

The fake stays active until you call `Process.reset_fake()`, so reset it in a fixture:

```python
# tests/test_deploy.py
import pytest

from fastapi_startkit.process import Process


@pytest.fixture
def process():
    fake = Process.fake()
    yield fake
    Process.reset_fake()


async def test_deploy_runs_the_script(process):
    await Process.run("bash deploy.sh")

    process.assert_ran("bash deploy.sh")
```

### Faking Output

To control what a command returns, pass a dictionary of commands to `Process.fake()`. Describe each result with `Process.describe()`, and use `"*"` for any command you didn't list:

```python
fake = Process.fake({
    "bash deploy.sh": Process.describe().output("Deployed").exit_code(0),
    "bash rollback.sh": Process.describe().error_output("Nothing to roll back").exit_code(1),
    "*": Process.describe().exit_code(0),
})

result = await Process.run("bash deploy.sh")
assert result.output() == "Deployed"

result = await Process.run("bash rollback.sh")
assert result.failed()
```

`output()` and `error_output()` may be called more than once; each call adds a line. `exit_code()` defaults to `0`.

### Assertions

`Process.fake()` returns a `ProcessFake` with the following assertions:

```python
fake.assert_ran("bash deploy.sh")
fake.assert_not_ran("bash rollback.sh")
fake.assert_ran_times("bash deploy.sh", 1)
fake.assert_nothing_ran()
```

`assert_ran()` also accepts a callable. It receives the `PendingProcess` and the fake `ProcessResult` of each recorded command and passes when any call returns `True`:

```python
fake.assert_ran(lambda process, result: result.command().startswith("bash"))
```
