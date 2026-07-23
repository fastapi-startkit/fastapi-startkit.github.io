---
outline: deep
title: Image Generation
description: Generate and edit images in FastAPI Startkit with a fluent, provider-agnostic API. Supports OpenAI DALL-E, Google Imagen 3, attachments-based editing, and one-line storage to any disk.
keywords: image generation, text-to-image, DALL-E, Imagen, OpenAI, Google Gemini, image editing, inpainting, FastAPI, fastapi-startkit
---

# Image Generation

::: warning Active development
The AI package is under active development. APIs may change without notice as we experiment with the best integration patterns. Use with caution in production.
:::

FastAPI Startkit ships a fluent, provider-agnostic **image generation** API. Describe an image in plain text, optionally attach a source photo for editing, and persist the result to any configured storage disk — all with a single chained expression.

## Introduction

The `Image` builder generates a new image from a text prompt (text-to-image) or edits an existing image when you attach a [`Document`](#editing-images). The active backend is selected from a single environment variable, so you can swap between OpenAI DALL-E and Google Imagen without touching application code.

**Supported providers:**

| Provider | Generation model | Editing | SDK |
|---|---|---|---|
| `openai` | DALL-E 3 (DALL-E 2 for edits) | ✅ Yes | `openai` |
| `google` | Imagen 3 (`imagen-3.0-generate-002`) | ❌ Not yet | `google-genai` |
| `stability` | — | — | _stub, not yet implemented_ |

`openai` is the default.

---

## Installation

Image generation with OpenAI is covered by the `ai` extra:

```bash
uv add "fastapi-startkit[ai]"
```

To use Google Imagen 3, install the newer Google GenAI SDK as well:

```bash
uv add google-genai
```

---

## Configuration

Select the active image provider and supply the matching API key in `.env`:

```ini
# .env
AI_IMAGE_PROVIDER=openai

OPENAI_API_KEY=sk-...
# For Google Imagen:
# AI_IMAGE_PROVIDER=google
# GEMINI_API_KEY=AIza...        # GOOGLE_API_KEY is also accepted
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `AI_IMAGE_PROVIDER` | `openai` | Active image backend: `openai`, `google`, or `stability` |
| `OPENAI_API_KEY` | — | API key for OpenAI / DALL-E |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI base URL (override for proxies / Azure) |
| `GEMINI_API_KEY` | — | API key for Google Imagen (`GOOGLE_API_KEY` is also accepted) |

These are read into the `AIConfig` dataclass — `image_provider` selects the backend, and the provider's API key and base URL are pulled from the matching entry in `providers`.

---

## Generating an Image

Call `Image.of()` with a prompt and `await` the `generate()` coroutine. It returns an [`ImageResponse`](#the-imageresponse-object):

```python
from fastapi_startkit.ai import Image

image = await Image.of("A donut on a marble counter, studio lighting").generate()

path = await image.store()   # save to the default disk
```

`generate()` is fully async — call it from any `async` endpoint or command.

### Sizes

DALL-E 3 supports three sizes. Use the chainable helpers instead of remembering pixel dimensions:

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

When using Google Imagen, these pixel sizes are mapped automatically to the nearest aspect ratio (`1:1`, `16:9`, `9:16`).

### Model and quality

Override the model or request higher quality (DALL-E 3 only):

```python
image = await (
    Image.of("A neon city skyline")
    .model("dall-e-3")     # default
    .quality("hd")         # 'standard' (default) or 'hd'
    .landscape()
    .generate()
)
```

For Google Imagen, pass an Imagen model name to `.model()`:

```python
image = await Image.of("A sunset over the sea").model("imagen-3.0-fast-generate-001").generate()
```

---

## Editing Images

Attach a source image as a [`Document`](/docs/ai/agent#documents) to switch from generation to **editing**. The prompt then describes the change you want:

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

`Document` can load source images from several places:

```python
Document.from_path("photo.jpg")             # local file (sync)
await Document.from_url("https://...")       # download (async)
await Document.from_storage("uploads/x.png") # application storage (async)
```

::: warning Provider support
Editing is implemented by the **OpenAI** backend only (it uses DALL-E 2, the model that supports inpainting). The Google backend raises `NotImplementedError` for edits — set `AI_IMAGE_PROVIDER=openai` for editing workflows. Only the first attachment is used; edits are produced at `1024×1024`.
:::

---

## The `ImageResponse` Object

`generate()` returns an `ImageResponse` holding the raw image bytes (PNG) plus async helpers to persist them.

### Accessing raw bytes

```python
image = await Image.of("A red bicycle").generate()

raw: bytes = image.data
```

### Storing to a disk

The storage helpers write to a configured [storage disk](/docs/storage) and return the stored path/filename. All are coroutines:

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

---

## Full Example

Generating an image inside a FastAPI route and returning its public URL:

```python
from fastapi_startkit.ai import Image
from fastapi_startkit.storage import Storage

async def create_avatar(prompt: str):
    image = await Image.of(prompt).square().quality("hd").generate()
    filename = await image.storePublicly()
    return {"url": Storage.disk("public").url(filename)}
```

---

## See Also

- [Audio Generation](/docs/ai/audio) — text-to-speech with the same fluent API
- [AI Agents](/docs/ai/agent) — LangChain-powered agents and the `Document` helper
- [Storage](/docs/storage) — disks, public URLs, and fake storage for tests
