---
outline: deep
title: Audio Generation
description: Turn text into speech in FastAPI Startkit with the Audio builder, which calls OpenAI text-to-speech and saves the result to any storage disk.
keywords: audio generation, text-to-speech, TTS, OpenAI, voices, speech synthesis, FastAPI, fastapi-startkit
---

# Audio Generation

## Introduction

The `Audio` builder turns text into speech. You pass the text, pick a voice, and await `generate()`. The result holds the audio bytes and can save itself to one of your [storage disks](/docs/storage), which makes it a good fit for narrating articles or reading notifications aloud.

Speech is generated with OpenAI's text-to-speech models.

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
`AI_DEFAULT_AUDIO_PROVIDER` doesn't switch the speech backend yet. Whatever you set it to, `Audio` sends the request to OpenAI, so keep `OPENAI_API_KEY` set.
:::

See [AI Agents](/docs/ai/agent) for the full AI configuration and `AIProvider`.

## Generating Audio

To generate speech, pass the text to `Audio.of()` and await `generate()`:

```python
from fastapi_startkit.ai import Audio

audio = await Audio.of("Your order has shipped and arrives on Friday.").generate()

filename = await audio.store()
# "1656a0c0-a366-4c89-8eeb-2bdd4a039ae0.mp3"
```

`generate()` returns an `AudioResponse` that holds the audio bytes. See [Storing Audio](#the-audioresponse-object) for the ways to save it.

::: warning
OpenAI has deprecated every model its speech endpoint serves, `gpt-4o-mini-tts` included, and shuts them down on January 6, 2027. There is no like-for-like replacement yet: `gpt-realtime-2.1-mini` is a realtime voice model, not a text-to-speech model for this endpoint.
:::

### Voices

The default voice is `alloy`. Use `female()` or `male()` for a preset, or name a voice with `voice()`:

```python
await Audio.of("Welcome back").female().generate()         # nova
await Audio.of("Welcome back").male().generate()           # onyx
await Audio.of("Welcome back").voice("shimmer").generate()
```

OpenAI's voices are `alloy`, `echo`, `fable`, `onyx`, `nova` and `shimmer`.

### Model, Speed, and Format

You can also choose the model, the speaking speed and the output format:

```python
audio = await (
    Audio.of("Chapter one. The storm had passed by morning.")
    .model("gpt-4o-mini-tts")
    .speed(0.9)
    .format("opus")
    .generate()
)
```

| Method | Default | Values |
|---|---|---|
| `model(name)` | an older built-in model | `gpt-4o-mini-tts`, which shuts down on January 6, 2027 |
| `speed(value)` | `1.0` | `0.25` to `4.0` |
| `format(fmt)` | `mp3` | `mp3`, `opus`, `aac` or `flac` |

`Audio` doesn't read a model from `config/ai.py`, so call `model("gpt-4o-mini-tts")` on each request. It is OpenAI's last speech-endpoint model, and has no like-for-like replacement yet.

## Storing Audio {#the-audioresponse-object}

`generate()` returns an `AudioResponse`. Its `data` property holds the raw audio bytes, for when you want to stream the audio or hand it to another service:

```python
audio = await Audio.of("Welcome back").generate()

mp3: bytes = audio.data
```

### Storing to a Disk

Most of the time you'll save the audio to a [storage disk](/docs/storage). Each method is a coroutine that returns the stored filename:

```python
filename = await audio.store()                                  # "local" disk, generated name
filename = await audio.storeAs("greetings/welcome.mp3")         # "local" disk, your name
filename = await audio.storePublicly()                          # "public" disk, generated name
filename = await audio.storePubliclyAs("greetings/welcome.mp3") # "public" disk, your name
```

| Method | Disk | Filename |
|---|---|---|
| `store()` | `local` | A UUID with the extension of the format, such as `.mp3` |
| `storeAs(name)` | `local` | `name` |
| `storePublicly()` | `public` | A UUID with the extension of the format |
| `storePubliclyAs(name)` | `public` | `name` |

Files on the `public` disk are served at `/storage/{filename}` (see [Public URLs](/docs/storage#public-urls)). If `StorageProvider` isn't registered, the audio is written to the system temp directory instead and the method returns that absolute path.

## Testing

Your tests shouldn't call OpenAI. Replace `Audio.generate` with a mock that returns an `AudioResponse`, and fake the disk the audio is stored on:

```python
# tests/test_announcements.py
from unittest.mock import AsyncMock, patch

from fastapi_startkit.ai import Audio, AudioResponse
from fastapi_startkit.storage import Storage


async def test_announcement_is_stored_publicly():
    disk = Storage.fake("public")

    with patch.object(Audio, "generate", AsyncMock(return_value=AudioResponse(b"ID3"))):
        audio = await Audio.of("Doors open at nine.").generate()
        await audio.storePubliclyAs("announcements/doors.mp3")

    disk.assert_exists("announcements/doors.mp3")
    disk.cleanup()
```

## Full Example

This route reads an announcement aloud, stores it on the `public` disk and returns its URL:

```python
# routes/api.py
from fastapi import APIRouter

from fastapi_startkit.ai import Audio

router = APIRouter()


@router.post("/announcements")
async def announce(text: str):
    audio = await Audio.of(text).female().model("gpt-4o-mini-tts").generate()
    filename = await audio.storePublicly()

    return {"url": f"/storage/{filename}"}
```

See [Image Generation](/docs/ai/image) for images with the same builder style, and [Storage](/docs/storage) for disks and public URLs.
