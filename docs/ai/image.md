---
outline: deep
title: Image Generation
description: Generate and edit images in FastAPI Startkit with a fluent, provider-agnostic API. Supports OpenAI DALL-E, Google Imagen 3, attachments-based editing, and one-line storage to any disk.
keywords: image generation, text-to-image, DALL-E, Imagen, OpenAI, Google Gemini, image editing, inpainting, FastAPI, fastapi-startkit
---

# Image Generation

## Introduction

The `Image` builder generates an image from a text prompt, or edits an existing image when you attach a [`Document`](#editing-images). The backend comes from the `AI_DEFAULT_IMAGE_PROVIDER` environment variable, so you can switch between OpenAI DALL-E and Google Imagen without changing your code.

| Provider | Generation model | Editing | SDK |
|---|---|---|---|
| `openai` | DALL-E 3 (DALL-E 2 for edits) | Yes | `openai` |
| `google` | Imagen 3 (`imagen-3.0-generate-002`) | Not yet | `google-genai` |
| `stability` | — | — | _stub, not yet implemented_ |

`openai` is the default. The builder sends `dall-e-3` unless you call [`.model()`](#model-and-quality), so set an Imagen model yourself when you use Google.

## Installation

Install the `ai` extra and the OpenAI SDK. The `ai` extra does not include it:

```bash
uv add "fastapi-startkit[ai]" openai
```

> The `fastapi-startkit[ai]` extra cannot be installed on Python 3.15 or newer yet, because its `langgraph` dependency requires `ormsgpack`, which does not support 3.15. Use Python 3.14 or older for the `ai` extra.

For Google Imagen 3, install the Google GenAI SDK instead:

```bash
uv add google-genai
```

## Configuration

Set the provider and its API key in `.env`:

```ini
# .env
AI_DEFAULT_IMAGE_PROVIDER=openai

OPENAI_API_KEY=sk-...
# For Google Imagen:
# AI_DEFAULT_IMAGE_PROVIDER=google
# GEMINI_API_KEY=AIza...        # GOOGLE_API_KEY is also accepted
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `AI_DEFAULT_IMAGE_PROVIDER` | `openai` | Active image backend: `openai`, `google`, or `stability` |
| `OPENAI_API_KEY` | — | API key for OpenAI / DALL-E |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI base URL (override for proxies / Azure) |
| `GEMINI_API_KEY` | — | API key for Google Imagen (`GOOGLE_API_KEY` is also accepted) |

These values are loaded into the `AIConfig` dataclass. `default_image` selects the backend, and the API key and base URL come from the matching entry in `providers`.

## Generating an Image

Pass a prompt to `Image.of()` and await `generate()`. It returns an [`ImageResponse`](#the-imageresponse-object):

```python
from fastapi_startkit.ai import Image

image = await Image.of("A donut on a marble counter, studio lighting").generate()

path = await image.store()   # save to the default disk
```

### Sizes

DALL-E 3 supports three sizes, each with its own method:

```python
await Image.of("A mountain range at dawn").landscape().generate()  # 1792×1024
await Image.of("A portrait of a fox").portrait().generate()        # 1024×1792
await Image.of("A logo mark").square().generate()                  # 1024×1024 (default)
```

| Method | Size | Notes |
|---|---|---|
| `.landscape()` | `1792×1024` | DALL-E 3 only |
| `.portrait()` | `1024×1792` | DALL-E 3 only |
| `.square()` | `1024×1024` | Default |

With Google Imagen, these sizes map to the nearest aspect ratio: `1:1`, `16:9`, or `9:16`.

### Model and quality

Set the model, or request higher quality on DALL-E 3:

```python
image = await (
    Image.of("A neon city skyline")
    .model("dall-e-3")     # default
    .quality("hd")         # 'standard' (default) or 'hd'
    .landscape()
    .generate()
)
```

For Google Imagen, always pass an Imagen model name to `.model()`:

```python
image = await Image.of("A sunset over the sea").model("imagen-3.0-fast-generate-001").generate()
```

## Editing Images

Attach a source image as a [`Document`](/docs/ai/agent#documents) to edit it instead of generating a new one. The prompt then describes the change:

```python
from fastapi_startkit.ai import Image, Document

source = await Document.from_url("https://example.com/photo.jpg")

image = await (
    Image.of("Turn this into an impressionist painting")
    .attachments([source])
    .generate()
)

await image.storePublicly()
```

`Document` can load an image from a local file, a URL, or application storage:

```python
Document.from_path("photo.jpg")             # local file (sync)
await Document.from_url("https://...")       # download (async)
await Document.from_storage("uploads/x.png") # application storage (async)
```

::: warning Provider support
Only the OpenAI backend supports editing. It uses DALL-E 2, the model that supports inpainting. The Google backend raises `NotImplementedError` for edits, so set `AI_DEFAULT_IMAGE_PROVIDER=openai` when you need them. Only the first attachment is used, and edits are always `1024×1024`.
:::

## The `ImageResponse` Object

`generate()` returns an `ImageResponse` with the raw PNG bytes and async methods for saving them.

### Accessing raw bytes

```python
image = await Image.of("A red bicycle").generate()

raw: bytes = image.data
```

### Storing to a disk

These methods write to a [storage disk](/docs/storage) and return the stored filename. All of them are coroutines:

```python
path = await image.store()                       # auto-named, private "local" disk
path = await image.storeAs("result.png")         # custom name, private "local" disk
path = await image.storePublicly()               # auto-named, public disk
path = await image.storePubliclyAs("result.png") # custom name, public disk
```

| Method | Disk | Filename |
|---|---|---|
| `store()` | `local` | Auto-generated (UUID) |
| `storeAs(name)` | `local` | `name` |
| `storePublicly()` | `public` | Auto-generated (UUID) |
| `storePubliclyAs(name)` | `public` | `name` |

Auto-generated filenames use a UUID with the image extension (e.g. `2f1c….png`). If the [Storage](/docs/storage) facade is unavailable, the bytes fall back to a file in the system temp directory and that absolute path is returned.

## Full Example

This route generates an image and returns its public URL:

```python
from fastapi_startkit.ai import Image
from fastapi_startkit.storage import Storage

async def create_avatar(prompt: str):
    image = await Image.of(prompt).square().quality("hd").generate()
    filename = await image.storePublicly()
    return {"url": Storage.disk("public").url(filename)}
```

## See Also

- [Audio Generation](/docs/ai/audio): text-to-speech with the same builder API
- [AI Agents](/docs/ai/agent): LangChain agents and the `Document` helper
- [Storage](/docs/storage): disks, public URLs, and fake storage for tests
