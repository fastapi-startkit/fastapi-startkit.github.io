# Storage

The Storage module provides a powerful and consistent API for managing files across different storage drivers like `local` and `s3`.

## Configuration

Storage is configured using the `StorageConfig` dataclass, typically published to `config/storage.py`.

```python
from dataclasses import dataclass, field
from fastapi_startkit.storage.config import StorageConfig as BaseStorageConfig
from fastapi_startkit.helpers.app import storage_path
from fastapi_startkit.environment import env

@dataclass
class StorageConfig(BaseStorageConfig):
    default: str = field(default_factory=lambda: env("FILESYSTEM_DISK", "local"))
    
    disks: dict = field(default_factory=lambda: {
        "local": {
            "driver": "local",
            "root": storage_path("app/private"),
            "serve": True,
            "throw": False,
            "report": False,
        },
        "public": {
            "driver": "local",
            "root": storage_path("app/public"),
            "url": env("APP_URL", "http://localhost").rstrip("/") + "/storage",
            "visibility": "public",
            "throw": False,
            "report": False,
        },
        "s3": {
            "driver": "s3",
            "key": env("AWS_ACCESS_KEY_ID"),
            "secret": env("AWS_SECRET_ACCESS_KEY"),
            "region": env("AWS_DEFAULT_REGION", "us-east-1"),
            "bucket": env("AWS_BUCKET"),
            "url": env("AWS_URL"),
            "endpoint": env("AWS_ENDPOINT"),
            "use_path_style_endpoint": env("AWS_USE_PATH_STYLE_ENDPOINT", False),
            "throw": False,
            "report": False,
        }
    })
```

## Basic Usage

You can use the `Storage` class to perform common file operations. By default, it uses the disk specified in your configuration.

```python
from fastapi_startkit.storage import Storage

# Store a file
Storage.put('example.txt', 'Hello World')

# Get file contents
content = Storage.get('example.txt')

# Check if file exists
if Storage.exists('example.txt'):
    # ...
```

## Disks

You can switch between different disks defined in your `config/storage.py`.

```python
# Use the S3 disk
Storage.disk('s3').put('backup.sql', content)

# Use a public local disk
Storage.disk('public').put('avatar.png', image_bytes)
```

## Available Methods

The following methods are available on both the `Storage` class (proxying to the default disk) and specific disk instances:

- `put(path, content)`: Write content to a file.
- `get(path)`: Retrieve the contents of a file.
- `exists(path)`: Check if a file exists.
- `missing(path)`: Check if a file is missing.
- `delete(path)`: Delete a file.
- `copy(from, to)`: Copy a file.
- `move(from, to)`: Move a file.
- `prepend(path, content)`: Prepend content to a file.
- `append(path, content)`: Append content to a file.
- `url(path)`: Get the public URL for a file.
- `download(path, name=None)`: Return a response to download the file.

## Download

The `download` method returns a FastAPI-compatible response (e.g., `FileResponse` for local, `RedirectResponse` for S3).

```python
@app.get("/download/{filename}")
async def download_file(filename: str):
    return Storage.download(f"uploads/{filename}")
```

## Testing (Faking Storage)

You can easily mock storage disks during testing using the `fake()` method. This replaces the target disk with a temporary local disk, ensuring no actual files are written to your production or cloud storage.

```python
import unittest
from fastapi_startkit.storage import Storage

class TestFileUpload(unittest.TestCase):
    def test_upload(self):
        # Fake the S3 disk
        Storage.fake('s3')
        
        # Perform your upload logic
        # ...
        
        # Assert the file was "uploaded"
        self.assertTrue(Storage.disk('s3').exists('photo.jpg'))
```
