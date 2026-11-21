---
outline: deep
title: Storage
description: Read and write files on local and S3 disks through the Storage class.
keywords: storage, file, local, s3, disk, upload, fastapi startkit
---

# Storage

The framework gives you one API for working with files, whether they live on the local filesystem or in Amazon S3. You configure named disks, and the `Storage` class reads and writes the default one. Because each disk has the same methods, you can keep files on the local disk in development and move them to S3 in production by changing `FILESYSTEM_DISK`.

- [Registering the Provider](#registering-the-provider)
- [Configuration](#configuration)
- [Basic Usage](#basic-usage)
- [Using a Specific Disk](#using-a-specific-disk)
- [Storing Uploaded Files](#storing-uploaded-files)
- [Public URLs](#public-urls)
- [Downloading Files](#downloading-files)
- [Testing with Fake Storage](#testing-with-fake-storage)
- [Adding a Custom Driver](#adding-a-custom-driver)

## Registering the Provider

Add `StorageProvider` to the providers in `bootstrap/application.py`:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.storage import StorageProvider

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        StorageProvider,
    ],
)
```

The provider registers a route that serves the `public` disk, so it needs the `fastapi` extra installed:

```bash
uv add "fastapi-startkit[fastapi]"
```

## Configuration

Three disks are configured by default, and `FILESYSTEM_DISK` picks the one the `Storage` class uses:

| Disk | Driver | Root |
|---|---|---|
| `local` | `local` | `storage/` (`FILESYSTEM_DISK_ROOT`) |
| `public` | `local` | `storage/app/public/` (`FILESYSTEM_PUBLIC_DISK_ROOT`) |
| `s3` | `s3` | The bucket in `AWS_BUCKET` |

A relative root is resolved against your application's base path.

### Publishing the Config

To change the disks, publish the config file:

```bash
uv run python artisan provider:publish --provider=storage
```

This writes `config/storage.py` into your project:

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
                key=env("AWS_ACCESS_KEY_ID", "", cast=False),
                secret=env("AWS_SECRET_ACCESS_KEY", "", cast=False),
                region=env("AWS_DEFAULT_REGION", "", cast=False),
                bucket=env("AWS_BUCKET", "", cast=False),
                url=env("AWS_URL", "", cast=False),
                endpoint=env("AWS_ENDPOINT", "", cast=False),
            ),
        }
    )
```

Then pass the class along with the provider:

```python
# bootstrap/application.py
from config.storage import StorageConfig

app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        (StorageProvider, StorageConfig),
    ],
)
```

### Amazon S3

The `s3` driver needs `boto3`, which isn't part of any extra:

```bash
uv add boto3
```

Then set your credentials and bucket:

```ini
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=your-bucket
AWS_URL=https://your-bucket.s3.amazonaws.com
```

For an S3-compatible service such as MinIO, set `AWS_ENDPOINT` to its URL and pass `use_path_style_endpoint=True` to `S3Config`.

## Basic Usage

Import `Storage` from the storage package. Its methods run on the default disk:

```python
from fastapi_startkit.storage import Storage
```

The examples below were run on the `local` disk. Every method is synchronous.

### Writing Files

`put()` writes contents to a path, creating any missing directories. Pass a `str` to write text or `bytes` to write binary data:

```python
Storage.put("reports/summary.txt", "Quarterly revenue: 42")
Storage.put("images/logo.png", png_bytes)
```

### Reading Files

`get()` returns the contents of a file, or `None` when the file doesn't exist. Text that decodes as UTF-8 comes back as a `str`, and anything else comes back as `bytes`. Use `get_bytes()` when you always want `bytes`:

```python
Storage.get("reports/summary.txt")        # "Quarterly revenue: 42"
Storage.get_bytes("images/logo.png")      # b"\x89PNG..."
Storage.get("reports/missing.txt")        # None
```

### Checking Existence

`exists()` tells you whether a file is there, and `missing()` tells you whether it isn't:

```python
if Storage.exists("reports/summary.txt"):
    ...

if Storage.missing("reports/summary.txt"):
    ...
```

### Copying and Moving

`copy()` and `move()` take a source path and a destination path:

```python
Storage.copy("reports/summary.txt", "archive/summary.txt")
Storage.move("archive/summary.txt", "archive/2026/summary.txt")
```

### Appending and Prepending

`append()` adds text to the end of a file, and `prepend()` adds it to the start. `prepend()` needs the file to exist:

```python
Storage.put("logs/orders.log", "order 1 created\n")
Storage.append("logs/orders.log", "order 2 created\n")
Storage.prepend("logs/orders.log", "# orders\n")

Storage.get("logs/orders.log")
# "# orders\norder 1 created\norder 2 created\n"
```

### Deleting Files

`delete()` removes a file. On the local disk, deleting a file that doesn't exist raises `FileNotFoundError`, so check first when the file may already be gone:

```python
if Storage.exists("reports/summary.txt"):
    Storage.delete("reports/summary.txt")
```

## Using a Specific Disk

To work with a disk other than the default, call `disk()` with its name. It returns the driver for that disk, with the same methods:

```python
Storage.disk("public").put("avatars/1.png", avatar_bytes)
Storage.disk("s3").get("invoices/2026-001.pdf")
```

## Storing Uploaded Files

`store()` writes an uploaded file to the disk. Wrap the contents and the original file name in a `File`, and pass the name to store it under. On the local disk, the extension of the original file name is added to that name, and `store()` returns the absolute path it wrote:

```python
# routes/web.py
from fastapi import UploadFile

from fastapi_startkit.fastapi import Router
from fastapi_startkit.storage import Storage
from fastapi_startkit.storage.file import File

router = Router()


async def update_avatar(avatar: UploadFile):
    path = Storage.store(File(await avatar.read(), avatar.filename), "avatar")
    return {"path": path}


router.post("/avatar", update_avatar)
```

Uploading `me.png` stores it as `storage/avatar.png`. If you leave out the name, the file is stored under the SHA-1 hash of its original name, such as `9c9b5e4595a25b7290488ab9d614cf9fe13d76e0.png`.

On the `s3` disk, `store()` uses the name exactly as you pass it, without adding an extension, and returns that key.

## Public URLs

`StorageProvider` serves the `public` disk at `/storage/{path}`, so a file written to `avatars/1.png` on that disk is available at `/storage/avatars/1.png`:

```python
Storage.disk("public").put("avatars/1.png", avatar_bytes)
# GET /storage/avatars/1.png
```

The response has a content type guessed from the file name, and a missing file returns `404`.

On the `s3` disk, `url()` joins `AWS_URL` and the path:

```python
Storage.disk("s3").url("avatars/1.png")
# "https://your-bucket.s3.amazonaws.com/avatars/1.png"
```

The local driver has no `url()` method.

## Downloading Files

`download()` returns a response you can return from a route. Pass the file name the browser should save it as:

```python
# routes/web.py
async def download_report():
    return Storage.download("reports/summary.txt", "summary.txt")


router.get("/reports/summary", download_report)
```

On the local disk this is a `FileResponse` with a `Content-Disposition: attachment` header. On the `s3` disk it's a redirect to a pre-signed URL that is valid for one hour.

## Testing with Fake Storage

`Storage.fake()` replaces a disk with a driver that writes to a new temporary directory, so your tests never touch real files. It returns the fake, which has the usual methods plus assertions. Call `cleanup()` to remove the directory when you're done:

```python
# tests/test_reports.py
from fastapi_startkit.storage import Storage


def test_report_is_written():
    fake = Storage.fake("local")

    Storage.put("reports/test.txt", "hello")

    fake.assert_exists("reports/test.txt")
    fake.assert_exists("reports/test.txt", content="hello")
    fake.assert_missing("reports/not-there.txt")
    fake.assert_count(1, "reports")

    fake.cleanup()
```

You can also use the fake as a context manager, which cleans up on exit. Called without a name, `fake()` replaces the default disk:

```python
with Storage.fake() as fake:
    Storage.put("reports/test.txt", "hello")
    fake.assert_exists(["reports/test.txt"])
```

`assert_exists()` and `assert_missing()` accept a path or a list of paths. `assert_directory_empty(directory)` checks that a directory has no files.

The fake replaces the driver, not only the disk you name, so every disk that uses the same driver writes to the fake too. Faking `local` also fakes `public`.

## Adding a Custom Driver

When the `local` and `s3` drivers don't fit, you can add your own. A driver is a plain class with the methods you call on it.

### Writing the Driver

The storage manager keeps one instance per driver name and calls `set_options()` with the disk's config each time the disk is resolved. Store the options and return `self`:

```python
# app/storage/memory_driver.py
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

`Storage` forwards `put`, `get`, `get_bytes`, `exists`, `missing`, `stream`, `copy`, `move`, `prepend`, `append`, `delete`, `store`, `download` and `url` to the driver. Calling one your driver doesn't define raises `AttributeError`.

Because disks that share a driver name share one instance, read `self.options` inside each method rather than copying values out of it in `set_options()`.

### Describing the Disk

A disk config is a dataclass whose `driver` names your driver. Its other fields are passed to `set_options()`:

```python
# config/storage.py
@dataclass
class MemoryDiskConfig(Config):
    driver: str = "memory"
    prefix: str = ""
```

Add the disk to `disks` in your `StorageConfig`, and set `default` to its name if it should be the default disk:

```python
# config/storage.py
disks: dict[str, Config] = field(
    default_factory=lambda: {
        # local, public and s3 ...
        "memory": MemoryDiskConfig(prefix="app/"),
    }
)
```

### Registering the Driver

Register the driver on the storage manager in a provider's `boot()` method:

```python
# providers/memory_storage_provider.py
from fastapi_startkit.support import Provider

from app.storage.memory_driver import MemoryDriver


class MemoryStorageProvider(Provider):
    def boot(self):
        self.app.make("storage").add_driver("memory", MemoryDriver(self.app))
```

```python
# bootstrap/application.py
app = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        (StorageProvider, StorageConfig),
        MemoryStorageProvider,
    ],
)
```

The new disk works like any other:

```python
Storage.disk("memory").put("notes.txt", "hello")
Storage.disk("memory").get("notes.txt")  # "hello"
```

`Storage.fake("memory")` replaces it with a temporary local driver, the same as the built-in disks.
