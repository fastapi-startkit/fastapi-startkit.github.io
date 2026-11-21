---
outline: deep
title: Image Generation
description: Generate and edit images in FastAPI Startkit with the Image builder, which calls OpenAI's image models and saves the result to any storage disk.
keywords: image generation, text-to-image, DALL-E, OpenAI, image editing, FastAPI, fastapi-startkit
---

# Image Generation

## Introduction

The `Image` builder turns a text prompt into an image, or edits an image you already have. You describe the picture, chain a few options such as the size, and await `generate()`. The result holds the image bytes and can save itself to one of your [storage disks](/docs/storage), so a hero image for a post or an avatar for a new user takes a few lines.

Image requests are sent to OpenAI: DALL-E 3 for new images and DALL-E 2 for edits.

- [Installation](#installation)
- [Configuration](#configuration)
- [Generating an Image](#generating-an-image)
- [Editing Images](#editing-images)
- [Storing Images](#the-imageresponse-object)
- [Testing](#testing)
- [Full Example](#full-example)

## Installation

Install the `ai` extra together with the OpenAI SDK:

```bash
uv add "fastapi-startkit[ai]" openai
```

## Configuration

Add your OpenAI key to the `.env` file:

```ini
# .env
OPENAI_API_KEY=sk-...
```

The OpenAI SDK reads `OPENAI_API_KEY` from the environment. To send requests through a proxy or another OpenAI-compatible endpoint, set `OPENAI_BASE_URL` as well.

::: warning
`AI_DEFAULT_IMAGE_PROVIDER` doesn't switch the image backend yet. Whatever you set it to, `Image` sends the request to OpenAI, so keep `OPENAI_API_KEY` set.
:::

See [AI Agents](/docs/ai/agent) for the full AI configuration and `AIProvider`.

## Generating an Image

To generate an image, pass a prompt to `Image.of()` and await `generate()`:

```python
from fastapi_startkit.ai import Image

image = await Image.of("A donut on a marble counter, studio lighting").generate()

filename = await image.store()
# "6b831c16-1735-4929-b711-342bedec73d7.png"
```

`generate()` returns an `ImageResponse` that holds the PNG bytes. See [Storing Images](#the-imageresponse-object) for the ways to save it.

::: warning
OpenAI shut down `dall-e-2` and `dall-e-3` on May 12, 2026, and the builder can't yet call the GPT Image models that replace them: it always sends `response_format`, which those models reject. Until the builder supports GPT Image models, image requests to OpenAI fail.
:::

### Sizes

Images are square by default. Call `landscape()` or `portrait()` for a wide or a tall image:

```python
await Image.of("A mountain range at dawn").landscape().generate()  # 1792x1024
await Image.of("A portrait of a fox").portrait().generate()        # 1024x1792
await Image.of("A logo mark").square().generate()                  # 1024x1024
```

The landscape and portrait sizes are DALL-E 3 sizes. If you switch to `dall-e-2`, keep the default square size.

### Model and Quality

The builder uses `dall-e-3` with `standard` quality. Call `quality("hd")` for finer detail, or `model()` to pick another OpenAI image model:

```python
image = await (
    Image.of("A neon city skyline")
    .model("dall-e-3")
    .quality("hd")
    .landscape()
    .generate()
)
```

The quality setting is sent only when the model is `dall-e-3`.

## Editing Images

To edit an image instead of generating a new one, attach it as a [`Document`](/docs/ai/agent). The prompt then describes the change you want:

```python
from fastapi_startkit.ai import Document, Image

photo = await Document.from_storage("uploads/avatar.png")

image = await (
    Image.of("Turn this into an impressionist painting")
    .attachments([photo])
    .generate()
)

filename = await image.storePublicly()
```

`Document` loads the source image from a local file, a URL or the `local` storage disk:

```python
photo = Document.from_path("photos/avatar.png")
photo = await Document.from_url("https://example.com/avatar.png")
photo = await Document.from_storage("uploads/avatar.png")
```

Edits always use `dall-e-2` and return a 1024x1024 image. Only the first attachment is sent, and the size, model and quality methods have no effect on an edit.

## Storing Images {#the-imageresponse-object}

`generate()` returns an `ImageResponse`. Its `data` property holds the raw PNG bytes, for when you want to stream the image or hand it to another service:

```python
image = await Image.of("A red bicycle").generate()

png: bytes = image.data
```

### Storing to a Disk

Most of the time you'll save the image to a [storage disk](/docs/storage). Each method is a coroutine that returns the stored filename:

```python
filename = await image.store()                           # "local" disk, generated name
filename = await image.storeAs("posts/hero.png")         # "local" disk, your name
filename = await image.storePublicly()                   # "public" disk, generated name
filename = await image.storePubliclyAs("posts/hero.png") # "public" disk, your name
```

| Method | Disk | Filename |
|---|---|---|
| `store()` | `local` | A UUID with a `.png` extension |
| `storeAs(name)` | `local` | `name` |
| `storePublicly()` | `public` | A UUID with a `.png` extension |
| `storePubliclyAs(name)` | `public` | `name` |

Files on the `public` disk are served at `/storage/{filename}` (see [Public URLs](/docs/storage#public-urls)). If `StorageProvider` isn't registered, the image is written to the system temp directory instead and the method returns that absolute path.

## Testing

Your tests shouldn't call OpenAI. Replace `Image.generate` with a mock that returns an `ImageResponse`, and fake the disk the image is stored on:

```python
# tests/test_avatars.py
from unittest.mock import AsyncMock, patch

from fastapi_startkit.ai import Image, ImageResponse
from fastapi_startkit.storage import Storage


async def test_avatar_is_stored_publicly():
    disk = Storage.fake("public")

    with patch.object(Image, "generate", AsyncMock(return_value=ImageResponse(b"\x89PNG"))):
        image = await Image.of("A friendly robot").generate()
        await image.storePubliclyAs("avatars/robot.png")

    disk.assert_exists("avatars/robot.png")
    disk.cleanup()
```

## Full Example

This route generates an avatar from a prompt, stores it on the `public` disk and returns its URL:

```python
# routes/api.py
from fastapi import APIRouter

from fastapi_startkit.ai import Image

router = APIRouter()


@router.post("/avatars")
async def create_avatar(prompt: str):
    image = await Image.of(prompt).square().quality("hd").generate()
    filename = await image.storePublicly()

    return {"url": f"/storage/{filename}"}
```

See [Audio Generation](/docs/ai/audio) for text-to-speech with the same builder style, and [Storage](/docs/storage) for disks and public URLs.
