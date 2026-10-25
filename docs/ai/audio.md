---
outline: deep
title: Audio Generation
description: Turn text into speech in FastAPI Startkit with a fluent text-to-speech API that works across OpenAI TTS, Google Gemini TTS, and ElevenLabs, with voice presets and one-line storage to any disk.
keywords: audio generation, text-to-speech, TTS, OpenAI, Google Gemini, ElevenLabs, voices, speech synthesis, FastAPI, fastapi-startkit
---

# Audio Generation

## Introduction

Whether you're narrating articles or reading notifications aloud, FastAPI Startkit's `Audio` builder turns text into speech and can save the result straight to a storage disk. The backend comes from the `AI_DEFAULT_AUDIO_PROVIDER` environment variable, so you can switch between OpenAI, Google Gemini, and ElevenLabs without changing your code.

| Provider | Model to use | Output | SDK |
|---|---|---|---|
| `openai` | `tts-1` | MP3 (configurable) | `openai` |
| `google` | `gemini-2.5-flash-preview-tts` | WAV | `google-genai` |
| `elevenlabs` | `eleven_multilingual_v2` | MP3 | `elevenlabs` |

`openai` is the default provider. The builder sends `tts-1` unless you call [`.model()`](#model-speed-and-format), so remember to set the model yourself when you use Google or ElevenLabs.

## Installation

To get started, install the `ai` extra along with the SDK for your provider. The extra doesn't include the OpenAI SDK:

```bash
uv add "fastapi-startkit[ai]" openai
```

> The `fastapi-startkit[ai]` extra cannot be installed on Python 3.15 or newer yet, because its `langgraph` dependency requires `ormsgpack`, which does not support 3.15. Use Python 3.14 or older for the `ai` extra.

If you're using Google or ElevenLabs, install their SDK instead of `openai`:

```bash
uv add google-genai   # for AI_DEFAULT_AUDIO_PROVIDER=google
uv add elevenlabs     # for AI_DEFAULT_AUDIO_PROVIDER=elevenlabs
```

## Configuration

Next, set the provider and its API key in your `.env` file:

```ini
# .env
AI_DEFAULT_AUDIO_PROVIDER=openai

OPENAI_API_KEY=sk-...
# For Google Gemini TTS:
# AI_DEFAULT_AUDIO_PROVIDER=google
# GEMINI_API_KEY=AIza...        # GOOGLE_API_KEY is also accepted
# For ElevenLabs:
# AI_DEFAULT_AUDIO_PROVIDER=elevenlabs
# ELEVENLABS_API_KEY=...
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `AI_DEFAULT_AUDIO_PROVIDER` | `openai` | Active TTS backend: `openai`, `google`, or `elevenlabs` |
| `OPENAI_API_KEY` | — | API key for OpenAI TTS |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI base URL (override for proxies / Azure) |
| `GEMINI_API_KEY` | — | API key for Google Gemini TTS (`GOOGLE_API_KEY` is also accepted) |
| `ELEVENLABS_API_KEY` | — | API key for ElevenLabs |

These values are loaded into the `AIConfig` dataclass, where `default_audio` selects the backend and the API key (plus the base URL for OpenAI) comes from the matching entry in `providers`.

## Generating Audio

To generate speech, pass the text to `Audio.of()` and await `generate()`, which returns an [`AudioResponse`](#the-audioresponse-object):

```python
from fastapi_startkit.ai import Audio

audio = await Audio.of("Hello world, welcome to FastAPI Startkit.").generate()

path = await audio.store()   # save to the default disk
```

### Voices

You can pick a voice with the `female()` and `male()` presets, or name one explicitly with `voice()`:

```python
await Audio.of("Hello world").female().generate()        # nova
await Audio.of("Hello world").male().generate()          # onyx
await Audio.of("Hello world").voice("shimmer").generate()
```

| Method | OpenAI voice |
|---|---|
| `.female()` | `nova` |
| `.male()` | `onyx` |
| `.voice(name)` | explicit name (default `alloy`) |

OpenAI offers `alloy`, `echo`, `fable`, `onyx`, `nova`, and `shimmer`.

The presets and OpenAI voice names work with Google and ElevenLabs too, where they map to that vendor's voices (see [Voices across providers](#voices-across-providers)). You're also free to pass a native voice name, such as the Google voice `Kore` or an ElevenLabs voice ID, to `.voice()`.

### Model, speed, and format

You can fine-tune the model, speaking speed, and output format by chaining a few more methods:

```python
audio = await (
    Audio.of("A higher quality, slower narration.")
    .model("tts-1-hd")   # default 'tts-1'; 'tts-1-hd' for higher quality
    .speed(0.9)          # 0.25 – 4.0, default 1.0
    .format("opus")      # mp3 (default), opus, aac, or flac
    .generate()
)
```

| Method | Default | Notes |
|---|---|---|
| `.model(name)` | `tts-1` | Use `tts-1-hd` for higher quality (OpenAI) |
| `.speed(value)` | `1.0` | Range `0.25`–`4.0` (OpenAI) |
| `.format(fmt)` | `mp3` | `mp3`, `opus`, `aac`, or `flac` (OpenAI) |

::: tip Provider differences
The Google and ElevenLabs backends accept `speed` but ignore it. The Google backend always returns WAV, whatever format you request, because Gemini TTS returns raw PCM that is wrapped in a WAV container. ElevenLabs always returns MP3.
:::

## Voices Across Providers

When you use a provider other than OpenAI, the OpenAI voice names are mapped to that provider's voices, so the same code works on every backend.

### Google Gemini

Google's native voices are `Kore`, `Aoede`, `Puck`, `Charon`, `Fenrir`, `Leda`, `Orus`, and `Zephyr`. The aliases map to them like this:

| Alias | Google voice |
|---|---|
| `nova` | `Aoede` |
| `alloy` | `Kore` |
| `echo` | `Charon` |
| `fable` | `Puck` |
| `onyx` | `Fenrir` |
| `shimmer` | `Leda` |

### ElevenLabs

You can pass any ElevenLabs voice ID directly to `.voice()`, or use one of the aliases:

| Alias | ElevenLabs name | Gender |
|---|---|---|
| `nova` | Rachel | female |
| `alloy` | Bella | female |
| `shimmer` | Elli | female |
| `onyx` | Adam | male |
| `echo` | Antoni | male |
| `fable` | Arnold | male |

## The `AudioResponse` Object

Every call to `generate()` returns an `AudioResponse`. It holds the raw audio bytes and gives you a handful of async methods for saving them.

### Accessing raw bytes

```python
audio = await Audio.of("Hello world").generate()

raw: bytes = audio.data
```

### Storing to a disk

Most of the time you'll want to save the audio somewhere. These methods write it to a [storage disk](/docs/storage) and return the stored filename. All of them are coroutines:

```python
path = await audio.store()                         # auto-named, private "local" disk
path = await audio.storeAs("greeting.mp3")         # custom name, private "local" disk
path = await audio.storePublicly()                 # auto-named, public disk
path = await audio.storePubliclyAs("greeting.mp3") # custom name, public disk
```

| Method | Disk | Filename |
|---|---|---|
| `store()` | `local` | Auto-generated (UUID) |
| `storeAs(name)` | `local` | `name` |
| `storePublicly()` | `public` | Auto-generated (UUID) |
| `storePubliclyAs(name)` | `public` | `name` |

Auto-generated filenames use a UUID with the extension of the requested format, for example `2f1c….mp3`, even when the provider returned WAV. If the [Storage](/docs/storage) facade is unavailable, the bytes are written to a file in the system temp directory instead, and you get that absolute path back.

## Full Example

Putting it all together, this route generates speech and returns its public URL:

```python
from fastapi_startkit.ai import Audio
from fastapi_startkit.storage import Storage

async def narrate(text: str):
    audio = await Audio.of(text).female().model("tts-1-hd").generate()
    filename = await audio.storePublicly()
    return {"url": Storage.disk("public").url(filename)}
```

## See Also

- [Image Generation](/docs/ai/image): text-to-image and image editing with the same builder API
- [AI Agents](/docs/ai/agent): LangChain agents and provider configuration
- [Storage](/docs/storage): disks, public URLs, and fake storage for tests
