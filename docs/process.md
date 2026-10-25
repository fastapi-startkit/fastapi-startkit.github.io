---
outline: deep
title: Process
description: Run shell commands, pipelines, and process pools with the Process facade, and fake them in tests.
keywords: process, subprocess, shell, commands, async, pipes, pools, testing, fastapi startkit
---

# Process

Sooner or later, most applications need to shell out to another program, whether that's running a build step, calling `git`, or kicking off a backup script. FastAPI Startkit's `Process` facade wraps Python's `subprocess` module in a small, expressive API built around those everyday needs. You can run shell commands with `await`, stream output from a background process, build pipelines, and run several commands at once. Best of all, you can fake it in your tests.

## Basic Usage

To run a command, pass it to `run()`. You'll get back a `ProcessResult`:

```python
from fastapi_startkit.process import Process

result = await Process.run('ls -la')

print(result.output())      # stdout as a string
print(result.exit_code())   # integer exit code
```

### Handling Success and Failure

The result tells you whether the command succeeded, so you can branch on it:

```python
result = await Process.run('git status')

if result.successful():
    print("Command succeeded")

if result.failed():
    print("Command failed:", result.error_output())
```

## ProcessResult API

| Method | Description |
|---|---|
| `output()` | Captured stdout |
| `error_output()` | Captured stderr |
| `error()` | Alias for `error_output()` |
| `output_json()` | stdout parsed as JSON; raises `json.JSONDecodeError` if it isn't valid JSON |
| `exit_code()` | The exit code |
| `successful()` | `True` if the exit code is `0` |
| `failed()` | `True` if the exit code is not `0` |
| `throw()` | Raises `ProcessFailedException` if the process failed, otherwise returns `self` |
| `throw_if(condition)` | Same as `throw()`, but only when `condition` is truthy |
| `command()` | The command string |

If you'd rather have a failed command stop everything, call `throw()`:

```python
result = await Process.run('python migrate.py')
result.throw()
```

### output_json()

When a command prints JSON, `output_json()` parses stdout for you:

```python
from fastapi_startkit.process import Process

result = await Process.run('cat data.json')
data = result.output_json()
print(data['name'])
```

If the output might not be JSON, catch `json.JSONDecodeError`:

```python
import json

from fastapi_startkit.process import Process

result = await Process.run('some_command')

try:
    data = result.output_json()
except json.JSONDecodeError:
    print("Could not parse output:", result.output())
```

## Fluent Builder Options

Most commands run fine with the defaults, but you can adjust how a process runs before you start it. Each of the option methods below returns a `PendingProcess`; chain the ones you need, then call `run()`:

### `timeout(seconds)`

Kills the process and raises `ProcessTimedOutException` after this many seconds. The default is 60.

```python
result = await Process.timeout(10).run('bash slow_script.sh')
```

### `forever()`

Disables the timeout entirely.

```python
result = await Process.forever().run('bash long_import.sh')
```

### `quietly()`

Discards stdout and stderr. This is handy when all you care about is the exit code.

```python
result = await Process.quietly().run('npm install')
```

### `tty()`

Connects stdin, stdout, and stderr to the terminal. Output is not captured.

```python
await Process.tty().run('vim file.txt')
```

### `env(variables)`

Adds environment variables for the process.

```python
result = await Process.env({'APP_ENV': 'production', 'DEBUG': '0'}).run('python app.py')
```

### `path(directory)`

Sets the working directory for the process.

```python
result = await Process.path('/var/www/app').run('git pull origin main')
```

### `input(data)`

Writes a string to the process's stdin.

```python
result = await Process.input('yes\n').run('apt-get install -y some-package')
```

### Combining Options

Since each option returns the same `PendingProcess`, you can chain as many as you like:

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

When you need to feed one command's output into another, `Process.pipe()` builds a shell pipeline for you. Its callback receives a `Pipe` builder, and you call `.command()` once for each stage:

```python
result = await Process.pipe(lambda p: (
    p.command('cat access.log'),
    p.command('grep "ERROR"'),
    p.command('wc -l'),
))

print(result.output())  # count of ERROR lines
```

The stages are joined with `|` and run as a single shell command. Any builder options you chain before `pipe()` apply to it:

```python
result = await Process.path('/var/www/app').timeout(15).pipe(lambda p: (
    p.command('find . -name "*.py"'),
    p.command('xargs wc -l'),
))
```

## Background Execution

Some commands take a while, and you don't always want to wait for them. `Process.start()` launches a process without blocking and returns an `InvokedProcess`. The callback receives each output line as it arrives:

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
`Process.start()` uses `subprocess.Popen` and reads output on background threads, not asyncio. Use it to stream output from long-running tasks. Inside FastAPI handlers, use `await Process.run()`.
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

When you have several independent commands to run, there's no need to run them one after another. `Process.pool()` runs them at once on background threads. Add the commands in the callback, call `.start()` to launch them, then `.wait()` for the results:

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

`PoolResults` supports indexing, iteration, `len()`, `successful()`, and `failed()`.

### Streaming Pool Output

To receive output as it arrives, pass a callback to `start()`. It is called with `(kind, line, index)`, where `index` is the position of the command in the pool:

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

Each command in a pool can have its own working directory. Set it with `.path()` inside the pool callback:

```python
pool = Process.pool(lambda p: (
    p.path('/srv/service-a').command('npm test'),
    p.path('/srv/service-b').command('npm test'),
)).start()

results = pool.wait()
```

## Testing with Fakes

Tests that start real processes are slow and depend on whatever happens to be installed on the machine. To avoid that, call `Process.fake()` at the start of an `async def` test. From then on, `run()` and `pipe()` return fake results instead of starting subprocesses. Only those two are faked: `start()` raises `NotImplementedError`, and pools still run real processes.

```python
from fastapi_startkit.process import Process

async def test_deploy_script():
    fake = Process.fake()

    # ... call code that internally runs Process.run('bash deploy.sh')

    fake.assert_ran('bash deploy.sh')

    Process.reset_fake()
```

Remember to call `Process.reset_fake()` in teardown, or later tests stay faked.

### Defining Fake Output

To control what each fake command returns, map command strings to descriptions built with `Process.describe()`:

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

Use `'*'` to match any command that isn't listed:

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

`Process.fake()` returns a `ProcessFake`, which you can use to assert which commands ran:

```python
fake.assert_ran('bash deploy.sh')
fake.assert_not_ran('bash rollback.sh')
fake.assert_ran_times('bash deploy.sh', 2)
fake.assert_nothing_ran()
```

For more control, `assert_ran()` also accepts a callable:

```python
fake.assert_ran(lambda pending, result: result.exit_code() == 0)
```

### Using a Fixture

If you fake processes in many tests, a pytest fixture can handle the teardown for you:

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

These are the exceptions you're most likely to run into.

### `ProcessFailedException`

`result.throw()` raises this when the exit code is not `0`. You'll find the result on `.result`:

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

Raised when a process runs past its timeout. You'll find the command on `.command`:

```python
from fastapi_startkit.process.exception import ProcessTimedOutException

try:
    result = await Process.timeout(5).run('sleep 60')
except ProcessTimedOutException as e:
    print("Timed out:", e.command)
```
