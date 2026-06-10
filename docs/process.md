---
outline: deep
title: Process
description: Run shell commands and manage subprocesses with a fluent, testable API in Fastapi Startkit.
keywords: process, subprocess, shell, commands, async, pipes, pools, testing, fastapi startkit
---

# Process

Fastapi Startkit ships a `Process` facade that wraps Python's `subprocess` module behind a clean, fluent interface. It lets you run shell commands asynchronously, stream output in the background, build pipelines, and run pools of concurrent processes — all with first-class support for test fakes so no real processes are spawned during your test suite.

## Basic Usage

Import `Process` and call `run()` with any shell command. It returns a `ProcessResult`:

```python
from fastapi_startkit.process import Process

result = await Process.run('ls -la')

print(result.output())      # stdout as a string
print(result.exit_code())   # integer exit code
```

### Handling Success and Failure

```python
result = await Process.run('git status')

if result.successful():
    print("Command succeeded")

if result.failed():
    print("Command failed:", result.error_output())
```

## ProcessResult API

Every `run()` call returns a `ProcessResult` with the following methods:

| Method | Description |
|---|---|
| `output()` | Returns captured stdout as a string |
| `error_output()` | Returns captured stderr as a string |
| `error()` | Alias for `error_output()` — stderr as a string |
| `json()` | Parses stdout as JSON and returns the decoded value; raises `ProcessJsonDecodeError` if stdout is not valid JSON |
| `exit_code()` | Returns the integer exit code |
| `successful()` | `True` if exit code is `0` |
| `failed()` | `True` if exit code is non-zero |
| `throw()` | Raises `ProcessFailedException` if the process failed, otherwise returns `self` |
| `throw_if(condition)` | Raises `ProcessFailedException` if `condition` is truthy |
| `command()` | Returns the original command string |

`throw()` is useful for asserting success after a run:

```python
result = await Process.run('python migrate.py')
result.throw()
# raises ProcessFailedException if migration fails
```

### json()

Parse the stdout of a process as JSON. Returns the decoded value, or raises `ProcessJsonDecodeError` if the output is not valid JSON:

```python
from fastapi_startkit.process import Process

result = await Process.run('cat data.json')
data = result.json()
print(data['name'])
```

To handle invalid JSON gracefully:

```python
from fastapi_startkit.process import Process
from fastapi_startkit.process.exception import ProcessJsonDecodeError

result = await Process.run('some_command')

try:
    data = result.json()
except ProcessJsonDecodeError as e:
    print("Could not parse output:", e.stdout)
```

## Fluent Builder Options

Any class method on `Process` that is not `run()`, `pipe()`, `start()`, or `pool()` returns a `PendingProcess` builder. Chain options before calling `run()`:

### `timeout(seconds)`

Sets how long to wait before killing the process and raising `ProcessTimedOutException`. The default is 60 seconds.

```python
result = await Process.timeout(10).run('bash slow_script.sh')
```

### `forever()`

Disables the timeout entirely.

```python
result = await Process.forever().run('bash long_import.sh')
```

### `quietly()`

Discards all stdout and stderr output. Useful when you only care about the exit code.

```python
result = await Process.quietly().run('npm install')
```

### `tty()`

Passes stdin, stdout, and stderr directly through to the terminal. Output is not captured.

```python
await Process.tty().run('vim file.txt')
```

### `env(variables)`

Merges additional environment variables into the process environment.

```python
result = await Process.env({'APP_ENV': 'production', 'DEBUG': '0'}).run('python app.py')
```

### `path(directory)`

Sets the working directory for the process.

```python
result = await Process.path('/var/www/app').run('git pull origin main')
```

### `input(data)`

Pipes a string into the process's stdin.

```python
result = await Process.input('yes\n').run('apt-get install -y some-package')
```

### Combining Options

Options chain together — each returns the same `PendingProcess`:

```python
result = await (
    Process
    .timeout(30)
    .path('/var/www/app')
    .env({'APP_ENV': 'staging'})
    .quietly()
    .run('bash deploy.sh')
)
```

## Piping

`Process.pipe()` builds a shell pipeline from multiple commands. Pass a callback that receives a `Pipe` builder and calls `.command()` for each stage:

```python
result = await Process.pipe(lambda p: (
    p.command('cat access.log'),
    p.command('grep "ERROR"'),
    p.command('wc -l'),
))

print(result.output())  # count of ERROR lines
```

The commands are joined with `|` and executed as a single shell command. All fluent builder options apply before calling `pipe()`:

```python
result = await Process.path('/var/www/app').timeout(15).pipe(lambda p: (
    p.command('find . -name "*.py"'),
    p.command('xargs wc -l'),
))
```

## Background Execution

Use `Process.start()` to launch a process in the background without blocking. It spawns a thread-backed `InvokedProcess` that streams output as lines arrive via a callback:

```python
import time

def on_output(kind, line):
    # kind is 'stdout' or 'stderr'
    print(f"[{kind}] {line}", end='')

invoked = Process.start('bash build.sh', callback=on_output)

while invoked.running():
    invoked.ensure_not_timed_out()
    time.sleep(0.5)

result = invoked.wait()
print("Exit code:", result.exit_code())
```

::: info Background execution uses threads
`Process.start()` launches the subprocess via `subprocess.Popen` and reads its output on background threads — it does **not** use asyncio. Use it for long-running tasks where you want to stream output in real time, not for general async usage inside FastAPI handlers (use `await Process.run()` for that).
:::

### `InvokedProcess` API

| Method | Description |
|---|---|
| `running()` | Returns `True` while the process is still executing |
| `pid()` | Returns the process ID |
| `wait()` | Blocks until the process finishes and returns a `ProcessResult` |
| `kill()` | Kills the process immediately |
| `signal(sig)` | Sends a signal (e.g. `signal.SIGTERM`) to the process |
| `ensure_not_timed_out()` | Raises `ProcessTimedOutException` if the configured timeout has elapsed |

## Pools (Concurrent Processes)

`Process.pool()` runs multiple commands concurrently using background threads. Pass a callback that adds commands to a `Pool`, then call `.start()` to launch all of them and `.wait()` to collect results:

```python
pool = Process.pool(lambda p: (
    p.command('bash job1.sh'),
    p.command('bash job2.sh'),
    p.command('bash job3.sh'),
)).start()

results = pool.wait()

for i, result in enumerate(results):
    print(f"Job {i}: exit {result.exit_code()}")

if results.successful():
    print("All jobs completed successfully")
```

Each process in a pool runs in parallel. `PoolResults` supports indexing, iteration, `len()`, `successful()`, and `failed()`.

### Streaming Pool Output

Pass a callback to `start()` to receive output lines as they arrive. The callback receives `(kind, line, index)` where `index` identifies which command produced the output:

```python
def on_output(kind, line, index):
    print(f"[job {index}] {line}", end='')

pool = Process.pool(lambda p: (
    p.command('bash job1.sh'),
    p.command('bash job2.sh'),
)).start(callback=on_output)

results = pool.wait()
```

### Pool Working Directories

Set a per-command working directory with `.path()` inside the pool callback:

```python
pool = Process.pool(lambda p: (
    p.path('/srv/service-a').command('npm test'),
    p.path('/srv/service-b').command('npm test'),
)).start()

results = pool.wait()
```

## Testing with Fakes

Call `Process.fake()` at the start of a test to intercept all process calls. No real subprocesses are spawned. Because `Process.run()` is async, test functions must be declared with `async def` and await every call.

```python
from fastapi_startkit.process import Process

async def test_deploy_script():
    fake = Process.fake()

    # ... call code that internally runs Process.run('bash deploy.sh')

    fake.assert_ran('bash deploy.sh')

    Process.reset_fake()
```

Always call `Process.reset_fake()` in teardown so subsequent tests run real processes.

### Defining Fake Output

Supply a dictionary mapping command strings to `FakeProcessDescription` objects built with `Process.describe()`:

```python
fake = Process.fake({
    'bash deploy.sh': Process.describe().output('Deployed successfully').exit_code(0),
    'bash rollback.sh': Process.describe().error_output('Rollback failed').exit_code(1),
})

result = await Process.run('bash deploy.sh')
assert result.output() == 'Deployed successfully'
assert result.successful()

result = await Process.run('bash rollback.sh')
assert result.failed()
```

Use `'*'` as a wildcard to match any command not explicitly listed:

```python
fake = Process.fake({'*': Process.describe().exit_code(0)})
```

### `FakeProcessDescription` API

| Method | Description |
|---|---|
| `output(text)` | Adds a stdout line to the fake result |
| `error_output(text)` | Adds a stderr line to the fake result |
| `exit_code(code)` | Sets the exit code (default `0`) |

### Assertions

`ProcessFake` (returned by `Process.fake()`) provides several assertion helpers:

```python
fake.assert_ran('bash deploy.sh')          # assert command was run
fake.assert_not_ran('bash rollback.sh')    # assert command was NOT run
fake.assert_ran_times('bash deploy.sh', 2) # assert exact run count
fake.assert_nothing_ran()                  # assert no commands ran at all
```

Pass a callable to `assert_ran()` for custom inspection:

```python
fake.assert_ran(lambda pending, result: result.exit_code() == 0)
```

### Using a Fixture

For pytest, a fixture makes teardown automatic:

```python
import pytest
from fastapi_startkit.process import Process

@pytest.fixture(autouse=True)
def fake_process():
    fake = Process.fake()
    yield fake
    Process.reset_fake()

async def test_my_command(fake_process):
    await Process.run('echo hello')
    fake_process.assert_ran('echo hello')
```

## Exception Handling

### `ProcessFailedException`

Raised by `result.throw()` when the process exits with a non-zero code. It exposes the original `ProcessResult` via `.result`:

```python
from fastapi_startkit.process.exception import ProcessFailedException

try:
    result = await Process.run('bash risky.sh')
    result.throw()
except ProcessFailedException as e:
    print(e.result.error_output())
    print("Exit code:", e.result.exit_code())
```

### `ProcessTimedOutException`

Raised when a process exceeds its configured timeout. It exposes `.command` — the command string that timed out:

```python
from fastapi_startkit.process.exception import ProcessTimedOutException

try:
    result = await Process.timeout(5).run('sleep 60')
except ProcessTimedOutException as e:
    print("Timed out:", e.command)
```
