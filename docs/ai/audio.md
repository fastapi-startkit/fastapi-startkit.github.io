---
outline: deep
title: Audio Generation
description: Generate speech from text in FastAPI Startkit with a fluent, provider-agnostic text-to-speech API. Supports OpenAI TTS, Google Gemini TTS, ElevenLabs, voice presets, and one-line storage to any disk.
keywords: audio generation, text-to-speech, TTS, OpenAI, Google Gemini, ElevenLabs, voices, speech synthesis, FastAPI, fastapi-startkit
---

# Audio Generation

FastAPI Startkit ships a fluent, provider-agnostic **text-to-speech** API. Turn any string into spoken audio, pick a voice, and persist the result to any configured storage disk — all in a single chained expression.

## Introduction

The `Audio` builder synthesizes speech from text. The active backend is selected from a single environment variable, so you can swap between OpenAI, Google Gemini, and ElevenLabs without changing application code.

**Supported providers:**

| Provider | Default model | Output | SDK |
|---|---|---|---|
| `openai` | `tts-1` | MP3 (configurable) | `openai` |
| `google` | `gemini-2.5-flash-preview-tts` | WAV | `google-genai` |
| `elevenlabs` | `eleven_multilingual_v2` | MP3 | `elevenlabs` |

`openai` is the default.

---

## Installation

Text-to-speech with OpenAI is covered by the `ai` extra:

```bash
uv add "fastapi-startkit[ai]"
```

The other backends use their own SDKs — install whichever you intend to use:

```bash
uv add google-genai   # for AI_AUDIO_PROVIDER=google
uv add elevenlabs     # for AI_AUDIO_PROVIDER=elevenlabs
```

---

## Configuration

Select the active audio provider and supply the matching API key in `.env`:

```ini
# .env
AI_AUDIO_PROVIDER=openai

OPENAI_API_KEY=sk-...
# For Google Gemini TTS:
# AI_AUDIO_PROVIDER=google
# GEMINI_API_KEY=AIza...        # GOOGLE_API_KEY is also accepted
# For ElevenLabs:
# AI_AUDIO_PROVIDER=elevenlabs
# ELEVENLABS_API_KEY=...
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `AI_AUDIO_PROVIDER` | `openai` | Active TTS backend: `openai`, `google`, or `elevenlabs` |
| `OPENAI_API_KEY` | — | API key for OpenAI TTS |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI base URL (override for proxies / Azure) |
| `GEMINI_API_KEY` | — | API key for Google Gemini TTS (`GOOGLE_API_KEY` is also accepted) |
| `ELEVENLABS_API_KEY` | — | API key for ElevenLabs |

These are read into the `AIConfig` dataclass — `audio_provider` selects the backend, and the provider's API key (and base URL, for OpenAI) are pulled from the matching entry in `providers`.

---

## Generating Audio

Call `Audio.of()` with the text to speak and `await` the `generate()` coroutine. It returns an [`AudioResponse`](#the-audioresponse-object):

```python
from fastapi_startkit.ai import Audio

audio = await Audio.of("Hello world, welcome to FastAPI Startkit.").generate()

path = await audio.store()   # save to the default disk
```

`generate()` is fully async — call it from any `async` endpoint or command.

### Voices

The quickest way to pick a voice is the gender presets. For full control, set an explicit voice name:

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

**OpenAI voices:** `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`.

The same preset and alias names work across providers — when you select Google or ElevenLabs, OpenAI-style names are mapped automatically to that vendor's voices (see [Voices across providers](#voices-across-providers)). You can also pass a native voice name (a Google voice like `Kore`, or an ElevenLabs voice ID) directly to `.voice()`.

### Model, speed, and format

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
`speed` is accepted for API compatibility but is **not** applied by the Google or ElevenLabs backends. The **Google** backend always returns **WAV** audio (Gemini TTS yields raw PCM that is wrapped in a WAV container) regardless of the requested format.
:::

---

## Voices Across Providers

When you use a provider other than OpenAI, the OpenAI-style preset/alias names are mapped automatically so your code stays portable.

### Google Gemini

Native voices: `Kore`, `Aoede`, `Puck`, `Charon`, `Fenrir`, `Leda`, `Orus`, `Zephyr`. Aliases map as:

| Alias | Google voice |
|---|---|
| `nova` | `Aoede` |
| `alloy` | `Kore` |
| `echo` | `Charon` |
| `fable` | `Puck` |
| `onyx` | `Fenrir` |
| `shimmer` | `Leda` |

### ElevenLabs

Pass any ElevenLabs voice ID directly to `.voice()`, or use an alias:

| Alias | ElevenLabs name | Gender |
|---|---|---|
| `nova` | Rachel | female |
| `alloy` | Bella | female |
| `shimmer` | Elli | female |
| `onyx` | Adam | male |
| `echo` | Antoni | male |
| `fable` | Arnold | male |

---

## The `AudioResponse` Object

`generate()` returns an `AudioResponse` holding the raw audio bytes plus async helpers to persist them.

### Accessing raw bytes

```python
audio = await Audio.of("Hello world").generate()

raw: bytes = audio.data
```

### Storing to a disk

The storage helpers write to a configured [storage disk](/docs/storage) and return the stored path/filename. All are coroutines:

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

Auto-generated filenames use a UUID with the output extension (e.g. `2f1c….mp3`). If the [Storage](/docs/storage) facade is unavailable, the bytes fall back to a file in the system temp directory and that absolute path is returned.

---

## Full Example

Synthesizing speech inside a FastAPI route and returning its public URL:

```python
from fastapi_startkit.ai import Audio
from fastapi_startkit.storage import Storage

async def narrate(text: str):
    audio = await Audio.of(text).female().model("tts-1-hd").generate()
    filename = await audio.storePublicly()
    return {"url": Storage.disk("public").url(filename)}
```

---

## See Also

- [Image Generation](/docs/ai/image) — text-to-image and editing with the same fluent API
- [AI Agents](/docs/ai/agent) — LangGraph-powered agents and provider configuration
- [Storage](/docs/storage) — disks, public URLs, and fake storage for tests
