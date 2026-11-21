---
outline: deep
title: Embeddings
description: Turn text into vectors in FastAPI Startkit with one API across OpenAI, Google, Bedrock, Ollama and OpenAI-compatible servers, store them in pgvector columns, query by cosine similarity, and fake them in tests.
keywords: embeddings, vector search, semantic search, pgvector, OpenAI embeddings, Gemini embeddings, Bedrock Titan, Ollama, FastAPI, fastapi-startkit
---

# Embeddings

## Introduction

Embeddings turn text into a list of numbers, so that texts with similar meaning end up close to each other. You use them for semantic search, recommendations and retrieval for your agents. The `Embeddings` builder generates them through the provider you configure, and the ORM can store the vectors in PostgreSQL and query them by similarity.

## Installation

Install the `ai` extra together with the integration for your provider:

```bash
uv add "fastapi-startkit[ai]" langchain-openai         # openai or openai-compatible
uv add "fastapi-startkit[ai]" langchain-google-genai   # google
uv add "fastapi-startkit[bedrock]"                     # bedrock
uv add "fastapi-startkit[ollama]"                      # ollama
```

## Configuration

First, register `AIProvider` in your application, as described in [AI Agents](/docs/ai/agent#registering-the-provider). It loads the AI configuration into the `ai` config key:

```python
# bootstrap/application.py
from pathlib import Path

from fastapi_startkit import Application
from fastapi_startkit.ai import AIProvider

app: Application = Application(
    base_path=Path(__file__).resolve().parent.parent,
    providers=[
        AIProvider,
    ],
)
```

::: warning
Register `AIProvider` even when you only fake embeddings in tests. Without it, `generate()` raises `ValueError: AI provider None uses unknown driver None`.
:::

Then choose the provider and add its credentials to your `.env` file:

```ini
# .env
AI_DEFAULT_EMBEDDINGS_PROVIDER=openai
OPENAI_API_KEY=sk-...

# For Google:
# AI_DEFAULT_EMBEDDINGS_PROVIDER=google
# GEMINI_API_KEY=AIza...        # GOOGLE_API_KEY is also accepted

# For Bedrock:
# AI_DEFAULT_EMBEDDINGS_PROVIDER=bedrock
# AWS_REGION=us-east-1

# For Ollama:
# AI_DEFAULT_EMBEDDINGS_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
```

Each provider has a default embeddings model, which you can override per call. The framework's built-in defaults can be older than the models recommended below, so set these models explicitly in `config/ai.py`, as shown in [Config File](./agent#config-file):

| Provider | Recommended model | Credentials |
|---|---|---|
| `openai` | `text-embedding-3-small` | `OPENAI_API_KEY` |
| `google` | `gemini-embedding-2` | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| `bedrock` | `amazon.titan-embed-text-v2:0` | `AWS_REGION` or `AWS_DEFAULT_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_PROFILE` |
| `ollama` | `nomic-embed-text` | `OLLAMA_BASE_URL` (default `http://localhost:11434`) |

For Bedrock, only the AWS settings you set are passed on. Anthropic and ElevenLabs don't offer embeddings, so sending a request to either raises a `ValueError`.

### Custom Providers

You can also embed through a provider you define yourself, such as a local server that speaks the OpenAI API. Give it the `openai-compatible` driver and a `default_embeddings` model:

```python
# config/ai.py
import os
from dataclasses import dataclass, field

from fastapi_startkit.ai import AIConfig as BaseAIConfig
from fastapi_startkit.ai import OpenAICompatibleConfig, OpenAIConfig
from fastapi_startkit.configuration import Config
from fastapi_startkit.environment import env


@dataclass
class AIConfig(BaseAIConfig):
    default_embeddings: str = env("AI_DEFAULT_EMBEDDINGS_PROVIDER", "local")

    providers: dict[str, Config] = field(default_factory=lambda: {
        "openai": OpenAIConfig(),
        "local": OpenAICompatibleConfig(
            url=os.getenv("LOCAL_AI_URL", "http://localhost:1234/v1"),
            models={"default_embeddings": "nomic-embed-text"},
        ),
    })
```

Register it with `(AIProvider, AIConfig)` in place of `AIProvider`. See [Custom and Local Providers](/docs/ai/agent#custom-and-local-providers) for the drivers and how the config is merged.

## Generating Embeddings

Pass a list of texts to `Embeddings.of()` and await `generate()`. You get one vector per input, in the same order:

```python
from fastapi_startkit.ai import Embeddings

response = await Embeddings.of([
    "Napa Valley has great wine.",
    "Laravel is a PHP framework.",
]).generate()

response.embeddings  # [[0.0123, ...], [0.0789, ...]]
response.first()     # the first vector
```

`generate()` accepts a provider name and a model, which override the configured defaults. Call `dimensions()` to ask for vectors of a given size, on models that support it:

```python
response = await (
    Embeddings.of(["Napa Valley has great wine."])
    .dimensions(256)
    .generate("openai", "text-embedding-3-large")
)
```

The `openai`, `openai-compatible`, `google` and `bedrock` drivers accept `dimensions()`. Ollama doesn't, and raises a `ValueError` when you set it.

### Reading the Response {#the-embeddingsresponse-object}

`generate()` returns an `EmbeddingsResponse`:

| Attribute | Description |
|---|---|
| `embeddings` | A list of vectors, one per input |
| `provider` | The provider name that was used, such as `openai` |
| `model` | The model that was used |
| `first()` | Returns the first vector |

### Embedding a Single String

To embed one string, call `to_embeddings()` on a `Str`. It returns the vector itself:

```python
from fastapi_startkit.support import Str

vector = await Str.of("Napa Valley has great wine.").to_embeddings()
```

It takes the same options as `generate()`, all optional:

```python
vector = await Str.of("wine country").to_embeddings(
    provider="openai",
    model="text-embedding-3-small",
    dimensions=1536,
)
```

`to_embeddings()` goes through `Embeddings`, so `Embeddings.fake()` fakes it as well.

## Storing Vectors with pgvector

Vector columns and vector queries need PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension. On any other database they raise a `ValueError`.

### Migrations

Enable the extension, then add a `vector` column with the size your model returns. Calling `.index()` on a vector column creates an HNSW index with `vector_cosine_ops`:

```python
# databases/migrations/2026_11_20_000000_create_documents_table.py
from fastapi_startkit.masoniteorm import Migration


class CreateDocumentsTable(Migration):
    async def up(self):
        await self.schema.ensure_vector_extension_exists()

        async with await self.schema.create("documents") as table:
            table.increments("id")
            table.string("title")
            table.vector("embedding", dimensions=1536).index()
            table.timestamps()

    async def down(self):
        await self.schema.drop("documents")
```

`ensure_vector_extension_exists()` runs `CREATE EXTENSION IF NOT EXISTS vector`. To index a vector column that already exists, call `table.vector_index("embedding")` inside `self.schema.table(...)`.

### Models

Annotate the vector column as `list[float]`. The model reads it back as a list:

```python
# app/models/document.py
from fastapi_startkit.masoniteorm import Model


class Document(Model):
    id: int
    title: str
    embedding: list[float]
```

Then embed the text and save the vector with the row:

```python
vector = await Str.of("Napa Valley has great wine.").to_embeddings()

await Document.create({"title": "Napa", "embedding": vector})
```

## Querying Vectors

The query builder has five vector methods. They use cosine distance (`<=>`), where `0` means identical. All of them except `or_where_vector_distance_less_than` are also available directly on the model.

### Similarity Search

`where_vector_similar_to()` keeps rows whose similarity is at least `min_similarity` (default `0.6`) and orders them closest first:

```python
query = await Str.of("wine country").to_embeddings()

documents = await (
    Document.where_vector_similar_to("embedding", query, min_similarity=0.4)
    .limit(10)
    .get()
)
```

Pass `order=False` to keep your own ordering.

### Distance Filters, Selects and Ordering

You can also filter by a maximum distance, or select the distance as a column:

```python
documents = await Document.where_vector_distance_less_than("embedding", query, 0.3).get()

documents = await (
    Document.select("title")
    .select_vector_distance("embedding", query)
    .order_by_vector_distance("embedding", query)
    .get()
)
documents[0].embedding_distance  # 0.12
```

| Method | SQL |
|---|---|
| `where_vector_similar_to(column, vector, min_similarity=0.6, order=True)` | `WHERE (col <=> ?) <= 1 - min_similarity`, then ordered by distance |
| `where_vector_distance_less_than(column, vector, max_distance)` | `WHERE (col <=> ?) <= max_distance` |
| `or_where_vector_distance_less_than(column, vector, max_distance)` | The same as an `OR` condition (query builder only) |
| `select_vector_distance(column, vector, as_=None)` | Adds `(col <=> ?) AS col_distance`, or the alias in `as_` |
| `order_by_vector_distance(column, vector)` | `ORDER BY (col <=> ?) ASC` |

::: warning
The vector methods take a list of floats, not text. Passing a string raises a `TypeError`, so embed it first with `await Str.of(text).to_embeddings()`.
:::

## Testing

Call `Embeddings.fake()` in a test, and no request reaches a provider. By default each input gets a random unit vector, sized to the requested dimensions, or 1536 when none were requested:

```python
from fastapi_startkit.ai import Embeddings

Embeddings.fake()

response = await Embeddings.of(["Napa Valley has great wine."]).generate()
len(response.first())  # 1536
```

Pass a list to return fixed vectors. Each item is the response for one call, as a list of vectors. When the list runs out, later calls get random vectors:

```python
Embeddings.fake([
    [[0.1, 0.2, 0.3]],                   # first call, one input
    [[0.4, 0.5, 0.6], [0.7, 0.8, 0.9]],  # second call, two inputs
])
```

You can also pass a callable that receives the `EmbeddingsPrompt` and returns the vectors:

```python
Embeddings.fake(lambda prompt: [Embeddings.fake_embedding(prompt.dimensions or 3) for _ in prompt.inputs])
```

To make sure every call has a prepared response, call `prevent_stray_embeddings()`. A call without one then raises a `RuntimeError`:

```python
Embeddings.fake([[[0.1, 0.2, 0.3]]]).prevent_stray_embeddings()
```

### Assertions

The assertions take a string, which is matched against the inputs, or a callable that receives the `EmbeddingsPrompt`:

```python
Embeddings.assert_generated("Napa")
Embeddings.assert_generated(lambda prompt: prompt.contains("Laravel") and prompt.dimensions == 1536)
Embeddings.assert_not_generated("Symfony")
Embeddings.assert_nothing_generated()
```

An `EmbeddingsPrompt` has `inputs`, `dimensions`, `provider` and `model`, and `contains(text)` checks whether any input includes the text. The assertions raise a `RuntimeError` when embeddings aren't faked.

Remove the fake when the test finishes. `Ai.reset_fakes()` removes it too:

```python
Embeddings.reset_fake()
```

See [Migrations](/docs/database/migrations) for creating tables and [Models](/docs/database/models) for model attributes.
