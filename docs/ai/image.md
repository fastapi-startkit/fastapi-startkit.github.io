---
outline: deep
title: Image Generation
description: Generate and edit images in FastAPI Startkit with a fluent API that works across providers, including OpenAI DALL-E and Google Imagen 3, with attachment-based editing and one-line storage to any disk.
keywords: image generation, text-to-image, DALL-E, Imagen, OpenAI, Google Gemini, image editing, inpainting, FastAPI, fastapi-startkit
---

# Image Generation

## Introduction

Need a hero image for a blog post or a fresh avatar for a new user? FastAPI Startkit's `Image` builder generates an image from a text prompt, or edits an existing one when you attach a [`Document`](#editing-images). The backend comes from the `AI_DEFAULT_IMAGE_PROVIDER` environment variable, so you can switch between OpenAI DALL-E and Google Imagen without changing your code.

| Provider | Generation model | Editing | SDK |
|---|---|---|---|
| `openai` | DALL-E 3 (DALL-E 2 for edits) | Yes | `openai` |
| `google` | Imagen 3 (`imagen-3.0-generate-002`) | Not yet | `google-genai` |
| `stability` | — | — | _stub, not yet implemented_ |

`openai` is the default provider. The builder sends `dall-e-3` unless you call [`.model()`](#model-and-quality), so remember to set an Imagen model yourself when you use Google.

## Installation

To get started, install the `ai` extra along with the OpenAI SDK, since the extra doesn't include it:

```bash
uv add "fastapi-startkit[ai]" openai
```

> The `fastapi-startkit[ai]` extra cannot be installed on Python 3.15 or newer yet, because its `langgraph` dependency requires `ormsgpack`, which does not support 3.15. Use Python 3.14 or older for the `ai` extra.

If you're using Google Imagen 3, install the Google GenAI SDK instead:

```bash
uv add google-genai
```

## Configuration

Next, set the provider and its API key in your `.env` file:

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

These values are loaded into the `AIConfig` dataclass, where `default_image` selects the backend and the API key and base URL come from the matching entry in `providers`.

## Generating an Image

To generate an image, pass a prompt to `Image.of()` and await `generate()`, which returns an [`ImageResponse`](#the-imageresponse-object):

```python
from fastapi_startkit.ai import Image

image = await Image.of("A donut on a marble counter, studio lighting").generate()

path = await image.store()   # save to the default disk
```

### Sizes

DALL-E 3 supports three sizes, and each one has its own method:

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

You can also choose the model, or ask DALL-E 3 for higher quality:

```python
image = await (
    Image.of("A neon city skyline")
    .model("dall-e-3")     # default
    .quality("hd")         # 'standard' (default) or 'hd'
    .landscape()
    .generate()
)
```

When you use Google Imagen, always pass an Imagen model name to `.model()`:

```python
image = await Image.of("A sunset over the sea").model("imagen-3.0-fast-generate-001").generate()
```

## Editing Images

To edit an existing image instead of generating a new one, attach it as a [`Document`](/docs/ai/agent#documents). The prompt then describes the change you want:

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

`Document` can load the source image from a local file, a URL, or application storage:

```python
Document.from_path("photo.jpg")             # local file (sync)
await Document.from_url("https://...")       # download (async)
await Document.from_storage("uploads/x.png") # application storage (async)
```

::: warning Provider support
Only the OpenAI backend supports editing. It uses DALL-E 2, the model that supports inpainting. The Google backend raises `NotImplementedError` for edits, so set `AI_DEFAULT_IMAGE_PROVIDER=openai` when you need them. Only the first attachment is used, and edits are always `1024×1024`.
:::

## The `ImageResponse` Object

Every call to `generate()` returns an `ImageResponse`. It holds the raw PNG bytes and gives you a handful of async methods for saving them.

### Accessing raw bytes

```python
image = await Image.of("A red bicycle").generate()

raw: bytes = image.data
```

### Storing to a disk

Most of the time you'll want to save the image somewhere. These methods write it to a [storage disk](/docs/storage) and return the stored filename. All of them are coroutines:

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

Auto-generated filenames use a UUID with the image extension, for example `2f1c….png`. If the [Storage](/docs/storage) facade is unavailable, the bytes are written to a file in the system temp directory instead, and you get that absolute path back.

## Full Example

Putting it all together, this route generates an image and returns its public URL:

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
