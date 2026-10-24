---
outline: deep
title: Storage
description: Read and write files on local and S3 disks through the Storage facade.
keywords: storage, file, local, s3, disk, fastapi startkit
---

# Storage

The `Storage` facade reads and writes files with the same methods on every disk: local, public, or Amazon S3.

Storage lets your application store and read files without caring where they live. You configure one or more disks, such as the local filesystem or an S3 bucket, and call the same methods on each:

- Write, read, append to, copy, move and delete files on any disk.
- Switch between disks, or change the default, through configuration instead of code.
- Save uploaded files straight to a disk.
- Serve files on the `public` disk over HTTP, or build S3 URLs.
- Replace a disk with a temporary fake in tests.

For example, you can keep files on the local disk in development and move them to S3 in production by changing `FILESYSTEM_DISK`, without touching the code that uses them.

## Registering the Provider

Add `StorageProvider` to your providers in `bootstrap/application.py`:

```python
from fastapi_startkit import Application
from fastapi_startkit.storage import StorageProvider

app = Application(
    base_path=...,
    providers=[
        StorageProvider,
        # ... other providers
    ]
)
```

## Publishing the Config

To change the disks, publish the config file:

```bash
uv run python artisan provider:publish --provider=storage
```

This copies `config/storage.py` into your project:

```python
# config/storage.py
from dataclasses import dataclass, field

from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env
from fastapi_startkit.storage import LocalDiskConfig, PublicDiskConfig, S3Config


@dataclass
class StorageConfig(Config):
    default: str = env("FILESYSTEM_DISK", "local")

    disks: dict[str, Config] = field(
        default_factory=lambda: {
            "local": LocalDiskConfig(
                root=env("FILESYSTEM_DISK_ROOT", "storage"),
            ),
            "public": PublicDiskConfig(
                root=env("FILESYSTEM_PUBLIC_DISK_ROOT", "storage/app/public"),
                url=env("FILESYSTEM_PUBLIC_DISK_URL", "/storage"),
            ),
            "s3": S3Config(
                key=env("AWS_ACCESS_KEY_ID", ""),
                secret=env("AWS_SECRET_ACCESS_KEY", ""),
                region=env("AWS_DEFAULT_REGION", ""),
                bucket=env("AWS_BUCKET", ""),
                url=env("AWS_URL", ""),
                endpoint=env("AWS_ENDPOINT", ""),
            ),
        }
    )
```

Then pass the class with the provider:

```python
from fastapi_startkit import Application
from fastapi_startkit.storage import StorageProvider
from config.storage import StorageConfig

app = Application(
    base_path=...,
    providers=[
        (StorageProvider, StorageConfig),
        # ... other providers
    ]
)
```

## Configuration

`FILESYSTEM_DISK` sets the default disk. Three disks are configured:

| Disk | Driver | Default root |
|---|---|---|
| `local` | Local filesystem | `storage/` (`FILESYSTEM_DISK_ROOT`) |
| `public` | Local filesystem, served over HTTP | `storage/app/public/` (`FILESYSTEM_PUBLIC_DISK_ROOT`) |
| `s3` | Amazon S3 | Set with the `AWS_*` variables |

## Basic Usage

Import the `Storage` facade:

```python
from fastapi_startkit.storage import Storage
```

### Writing Files

```python
Storage.put("reports/summary.txt", "Report content here")
```

### Reading Files

```python
content = Storage.get("reports/summary.txt")
```

### Checking Existence

```python
if Storage.exists("reports/summary.txt"):
    ...

if Storage.missing("reports/summary.txt"):
    ...
```

### Deleting Files

```python
Storage.delete("reports/summary.txt")
```

### Copying and Moving

```python
Storage.copy("reports/summary.txt", "archive/summary.txt")
Storage.move("reports/summary.txt", "archive/summary.txt")
```

### Appending and Prepending

```python
Storage.append("logs/app.log", "\nNew log entry")
Storage.prepend("logs/app.log", "Log start\n")
```

## Using a Specific Disk

Call `disk()` to use a disk other than the default:

```python
Storage.disk("s3").put("uploads/photo.jpg", file_bytes)
Storage.disk("public").get("images/banner.png")
```

## Storing Uploaded Files

`store()` writes a `File` to the disk. The second argument is the file name without its extension; the extension comes from the original file name. It returns the absolute path of the stored file:

```python
from fastapi import UploadFile
from fastapi_startkit.storage import Storage
from fastapi_startkit.storage.file import File

async def upload(file: UploadFile):
    path = Storage.store(File(await file.read(), file.filename), "avatar")
    return {"path": path}
```

Without a name, the file is stored under a SHA-1 hash of its original name.

## Public URLs

When the application uses `FastAPIProvider`, `StorageProvider` serves the `public` disk at `/storage/{path}`. A file written to `images/avatar.png` on the public disk is available at `/storage/images/avatar.png`:

```python
Storage.disk("public").put("images/avatar.png", image_bytes)
# GET /storage/images/avatar.png
```

The `s3` disk has a `url()` method that joins `AWS_URL` and the path:

```python
Storage.disk("s3").url("images/avatar.png")
# → {AWS_URL}/images/avatar.png
```

## Testing with Fake Storage

`Storage.fake()` replaces a disk with a driver that writes to a temporary directory. Call `cleanup()` to remove the directory, or use the fake as a context manager. The fake has the same methods as the local driver, plus assertions:

```python
fake = Storage.fake("local")

Storage.put("reports/test.txt", "hello")

fake.assert_exists("reports/test.txt")
fake.assert_exists("reports/test.txt", content="hello")
fake.assert_missing("reports/not-there.txt")
fake.assert_count(1, "reports")

fake.cleanup()
```

`assert_exists()` and `assert_missing()` also accept a list of paths. `assert_directory_empty(directory)` checks that a directory has no files.

## Adding a Custom Driver

A driver is a plain class. There is no base class to extend: the storage manager calls the methods the `Storage` facade exposes, so a driver implements the ones you use. The built-in `local` and `s3` drivers are registered the same way.

### 1. Write the Driver

The manager keeps one driver instance per driver name and calls `set_options()` with the disk's configuration every time the disk is resolved. Store the options and return `self`:

```python
class MemoryDriver:
    def __init__(self, application):
        self.application = application
        self.options = {}
        self.files = {}

    def set_options(self, options):
        self.options = options
        return self

    def key(self, path):
        return f"{self.options.get('prefix', '')}{path}"

    def put(self, file_path, content):
        self.files[self.key(file_path)] = content
        return content

    def get(self, file_path):
        return self.files.get(self.key(file_path))

    def exists(self, file_path):
        return self.key(file_path) in self.files

    def missing(self, file_path):
        return not self.exists(file_path)

    def delete(self, file_path):
        self.files.pop(self.key(file_path), None)
```

The facade methods are `put`, `get`, `exists`, `missing`, `stream`, `copy`, `move`, `prepend`, `append`, `delete`, `store`, `download` and `url`. Calling one the driver does not define raises `AttributeError`. For a full reference, see `LocalDriver` and `S3Driver` in `fastapi_startkit.storage.drivers`.

### 2. Describe the Disk

A disk's `driver` value names the driver you register in the next step. Its other fields are passed to `set_options()`:

```python
from dataclasses import dataclass

from fastapi_startkit.configuration import Config


@dataclass
class MemoryDiskConfig(Config):
    driver: str = "memory"
    prefix: str = ""
```

Add it to the `disks` of your `StorageConfig`, and point `default` at it if you want it to be the default disk:

```python
# config/storage.py
disks: dict[str, Config] = field(
    default_factory=lambda: {
        # ... local, public and s3
        "memory": MemoryDiskConfig(prefix="app/"),
    }
)
```

### 3. Register the Driver

Register the driver on the storage manager in a provider's `boot()` method. Every provider's `register()` runs before any `boot()`, so the manager is already bound and the provider can sit anywhere in the list:

```python
from fastapi_startkit.support import Provider


class MemoryStorageProvider(Provider):
    def boot(self):
        self.app.make("storage").add_driver("memory", MemoryDriver(self.app))
```

```python
app = Application(
    base_path=...,
    providers=[
        (StorageProvider, StorageConfig),
        MemoryStorageProvider,
    ]
)
```

### 4. Use the Disk

```python
Storage.disk("memory").put("notes.txt", "hello")
Storage.disk("memory").get("notes.txt")  # "hello"
```

With `default` set to `"memory"`, `Storage.put()` and the other facade methods use it too.

Disks that share a driver name share one driver instance, so read `self.options` when each method runs instead of caching values when the driver is created.

`Storage.fake("memory")` replaces the driver registered under the disk's driver name with a temporary local one, so tests can fake custom disks as well.
