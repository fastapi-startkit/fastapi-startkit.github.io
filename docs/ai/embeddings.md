---
outline: deep
title: Embeddings
description: Turn text into vectors in FastAPI Startkit with one fluent API across OpenAI, Google and Bedrock, store them in pgvector columns, query by cosine similarity, and fake them in tests.
keywords: embeddings, vector search, semantic search, pgvector, OpenAI embeddings, Gemini embeddings, Bedrock Titan, FastAPI, fastapi-startkit
---

# Embeddings

## Introduction

Embeddings turn text into a list of numbers, so that texts with similar meaning end up close to each other. They are the building block for semantic search, recommendations and retrieval for your agents. The `Embeddings` builder generates them through the provider set in `AI_DEFAULT_EMBEDDINGS_PROVIDER`, so you can switch providers without touching your code.

| Provider | Default model | LangChain package |
|---|---|---|
| `openai` | `text-embedding-3-small` | `langchain-openai` |
| `google` | `gemini-embedding-001` | `langchain-google-genai` |
| `bedrock` | `amazon.titan-embed-text-v2:0` | `langchain-aws` |

`openai` is the default provider. Anthropic and ElevenLabs don't offer embeddings, and choosing either one raises a `ValueError`.

## Installation

Install the `ai` extra together with the LangChain package for your provider:

```bash
uv add "fastapi-startkit[ai]" langchain-openai
# or: uv add "fastapi-startkit[ai]" langchain-google-genai
# or: uv add "fastapi-startkit[bedrock]"
```

> The `fastapi-startkit[ai]` extra cannot be installed on Python 3.15 or newer yet, because its `langgraph` dependency requires `ormsgpack`, which does not support 3.15. Use Python 3.14 or older for the `ai` extra.

## Configuration

Set the provider and its credentials in your `.env` file:

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
```

These values are loaded into `AIConfig`: `default_embeddings` picks the provider, and the key and default model come from the matching entry in `providers`. The OpenAI and Google keys are passed to LangChain as `api_key`. Bedrock doesn't take a key; it uses the region, credentials and profile from `BedrockConfig` (`AWS_REGION` or `AWS_DEFAULT_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` and `AWS_PROFILE`), and only the ones you set are passed on.

## Generating Embeddings

Pass a list of texts to `Embeddings.of()` and await `generate()`. You get one vector per input, in the same order:

```python
from fastapi_startkit.ai import Embeddings

response = await Embeddings.of([
    "Napa Valley has great wine.",
    "Laravel is a PHP framework.",
]).generate()

response.embeddings  # [[0.123, ...], [0.789, ...]]
response.first()     # the first vector
```

`generate()` accepts a provider and a model, which override the configured defaults. `dimensions()` asks for vectors of a given size, for models that support it:

```python
response = await (
    Embeddings.of(["Napa Valley has great wine."])
    .dimensions(1536)
    .generate("openai", "text-embedding-3-small")
)
```

The size is sent as `dimensions` to OpenAI, `output_dimensionality` to Google, and `model_kwargs={"dimensions": n}` to Bedrock.

### The `EmbeddingsResponse` object

| Attribute | Description |
|---|---|
| `embeddings` | A list of vectors, one per input |
| `provider` | The provider that was used, such as `openai` |
| `model` | The model that was used |
| `first()` | Returns the first vector |

### Embedding a single string

To embed one string, call `to_embeddings()` on a `Stringable`. It returns the vector itself:

```python
from fastapi_startkit.support import Str

vector = await Str.of("Napa Valley has great wine.").to_embeddings()
```

It takes the same options as `generate()`, all optional:

```python
vector = await Str.of(query).to_embeddings(provider="openai", model="text-embedding-3-small", dimensions=1536)
```

`to_embeddings()` goes through `Embeddings`, so `Embeddings.fake()` fakes it as well.

## Storing Vectors with pgvector

Vector columns and vector queries need PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension. On any other database they raise a `ValueError`.

### Migrations

Enable the extension, then add a `vector` column with the size your model returns. Calling `.index()` on a vector column creates an HNSW index with `vector_cosine_ops` instead of a regular B-tree index:

```python
from fastapi_startkit.masoniteorm.migrations import Migration


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

`ensure_vector_extension_exists()` runs `CREATE EXTENSION IF NOT EXISTS vector`. To index a vector column that already exists, use `table.vector_index("embedding")`.

### Models

Annotate the column as `list[float]`. The model then stores it as a JSON array and reads it back as a list:

```python
from fastapi_startkit.masoniteorm import Model


class Document(Model):
    __fillable__ = ["title", "embedding"]

    id: int
    title: str
    embedding: list[float]
```

```python
vector = await Str.of("Napa Valley has great wine.").to_embeddings()

await Document.create({"title": "Napa", "embedding": vector})
```

## Querying Vectors

The query builder has four vector methods. They use cosine distance (`<=>`), where `0` means identical, and are also available directly on the model.

### Similarity search

`where_vector_similar_to()` keeps rows whose similarity is at least `min_similarity` (default `0.6`) and orders them closest first:

```python
query = await Str.of("wine country").to_embeddings()

documents = await (
    Document.where_vector_similar_to("embedding", query, min_similarity=0.4)
    .limit(10)
    .get()
)
```

Under the hood it filters on `distance <= 1 - min_similarity`. Pass `order=False` to keep your own ordering.

### Distance filters, selects and ordering

```python
# Rows within a distance of 0.3
await Document.where_vector_distance_less_than("embedding", query, 0.3).get()

# Add the distance as a column, closest first
documents = await (
    Document.select("title")
    .select_vector_distance("embedding", query)
    .order_by_vector_distance("embedding", query)
    .get()
)
documents[0].embedding_distance
```

| Method | SQL |
|---|---|
| `where_vector_similar_to(column, vector, min_similarity=0.6, order=True)` | `WHERE (col <=> ?) <= 1 - min_similarity`, then ordered by distance |
| `where_vector_distance_less_than(column, vector, max_distance)` | `WHERE (col <=> ?) <= max_distance` |
| `or_where_vector_distance_less_than(column, vector, max_distance)` | The same as an `OR` condition (query builder only) |
| `select_vector_distance(column, vector, as_=None)` | Adds `(col <=> ?) AS col_distance`, or the alias in `as_` |
| `order_by_vector_distance(column, vector)` | `ORDER BY (col <=> ?) ASC` |

::: warning Embed first, then query
The query builder is synchronous, so it can't call an embeddings provider for you. Pass a list of floats, not text. Passing a string raises a `TypeError`; embed it first with `await Str.of(text).to_embeddings()`.
:::

## Testing

Call `Embeddings.fake()` in a test, and no request reaches a provider. By default each input gets a random unit vector, sized to the requested dimensions or 1536 when none were requested:

```python
from fastapi_startkit.ai import Embeddings

Embeddings.fake()

response = await Embeddings.of(["Napa Valley has great wine."]).generate()
len(response.first())  # 1536
```

Pass a list to return fixed vectors. Each item is the response for one call, as a list of vectors. When the list runs out, calls fall back to random vectors:

```python
Embeddings.fake([
    [[0.1, 0.2, 0.3]],              # first call
    [[0.4, 0.5, 0.6], [0.7, 0.8, 0.9]],  # second call, two inputs
])
```

Or pass a callable that receives the `EmbeddingsPrompt` and returns the vectors:

```python
Embeddings.fake(lambda prompt: [Embeddings.fake_embedding(prompt.dimensions or 3) for _ in prompt.inputs])
```

To make sure every call has a prepared response, call `prevent_stray_embeddings()`. A call without one then raises a `RuntimeError`:

```python
Embeddings.fake([[[0.1, 0.2, 0.3]]]).prevent_stray_embeddings()
```

### Assertions

The assertions take a string, matched against the inputs, or a callable that receives the `EmbeddingsPrompt`:

```python
Embeddings.assert_generated(lambda prompt: prompt.contains("Laravel") and prompt.dimensions == 1536)
Embeddings.assert_generated("Napa")
Embeddings.assert_not_generated("Other")
Embeddings.assert_nothing_generated()
```

The `EmbeddingsPrompt` has `inputs`, `dimensions`, `provider` and `model`, and `contains(text)` checks whether any input includes the text. The assertions raise a `RuntimeError` when embeddings aren't faked.

Remove the fake when the test finishes. `Ai.reset_fakes()` removes it too:

```python
Embeddings.reset_fake()
```

## See Also

- [Agents](/docs/ai/agent): chat agents use the same `AIConfig` providers
- [Migrations](/docs/database/migrations): creating tables and columns
- [Models](/docs/database/models): model attributes and casts
