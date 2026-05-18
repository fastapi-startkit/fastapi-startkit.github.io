---
outline: deep
title: Storage
description: Manage file storage with a unified API across local and S3-compatible disks.
keywords: storage, file, local, s3, disk, fastapi startkit
---

# Storage

FastAPI Startkit provides a unified file storage API that works the same way regardless of where files are stored — local disk, public disk, or Amazon S3.

## Registering the Provider

Add `StorageProvider` to your application's provider list in `bootstrap/application.py`:

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

Publish the default config file to your project:

```bash
uv run python artisan provider:publish --provider=storage
```

This copies `config/storage.py` into your project. Open it to customise the default disk or add new disks:

```python
# config/storage.py
from dataclasses import dataclass, field
from typing import Any, Dict

from fastapi_startkit.environment import env
from fastapi_startkit.storage import LocalDiskConfig, PublicDiskConfig, S3Config


@dataclass
class StorageConfig:
    default: str = field(default_factory=lambda: env("FILESYSTEM_DISK", "local"))

    disks: dict[str, Dict[str, Any]] = field(
        default_factory=lambda: {
            "local": LocalDiskConfig(
                root=env("FILESYSTEM_DISK_ROOT", "storage"),
            ),
            "public": PublicDiskConfig(
                root=env("FILESYSTEM_PUBLIC_DISK_ROOT", "storage/app/public"),
                url=env("FILESYSTEM_PUBLIC_DISK_URL", "/storage"),
            ),
            "s3": S3Config(
                key=env("AWS_ACCESS_KEY_ID"),
                secret=env("AWS_SECRET_ACCESS_KEY"),
                region=env("AWS_DEFAULT_REGION"),
                bucket=env("AWS_BUCKET"),
                url=env("AWS_URL"),
                endpoint=env("AWS_ENDPOINT"),
            ),
        }
    )
```

Then wire the config into the provider in `bootstrap/application.py`:

```python
from fastapi_startkit import Application
from fastapi_startkit.storage.providers.provider import StorageProvider
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

Storage is configured in `config/storage.py`. The `FILESYSTEM_DISK` environment variable controls which disk is active by default.

Three disks are pre-configured out of the box:

| Disk | Driver | Default root |
|---|---|---|
| `local` | Local filesystem | `storage/` |
| `public` | Local filesystem (web-accessible) | `storage/app/public/` |
| `s3` | Amazon S3 | Configured via `AWS_*` env vars |

## Basic Usage

Import the `Storage` facade for static access anywhere in your application:

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

Call `.disk()` to target a disk other than the default:

```python
Storage.disk("s3").put("uploads/photo.jpg", file_bytes)
Storage.disk("public").get("images/banner.png")
```

## Storing Uploaded Files

Use `.store()` to save an uploaded file object (e.g. from a FastAPI `UploadFile`):

```python
from fastapi import UploadFile

async def upload(file: UploadFile):
    path = Storage.store(file, "uploads")
    return {"path": path}
```

## Public URLs

Get a publicly accessible URL for a file on the public disk:

```python
url = Storage.disk("public").url("images/avatar.png")
# → /storage/images/avatar.png
```

## Testing with Fake Storage

Use `Storage.fake()` in tests to replace a disk with an in-memory fake. The fake supports the same API as the real driver plus assertion helpers:

```python
fake = Storage.fake("local")

Storage.put("reports/test.txt", "hello")

fake.assertExists("reports/test.txt")
fake.assertMissing("reports/not-there.txt")
```
