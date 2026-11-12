---
outline: deep
title: Classification
description: Classify text in FastAPI Startkit with Boolean, Choice and Score questions. Google uses the Gemini Decisions API for calibrated probabilities, and every other provider falls back to validated structured output.
keywords: classification, text classification, Decisions API, gemini-decision-1, structured output, Boolean, Choice, Score, OpenAI, Anthropic, FastAPI, fastapi-startkit
---

# Classification

## Introduction

Classification answers a fixed set of questions about one piece of text: is it urgent, which team owns it, how angry is the customer. You describe each question once, and you get back typed answers that are already checked against the options you allowed.

```python
from fastapi_startkit.ai import Classification
from fastapi_startkit.ai.classification import Boolean, Choice, Score

result = await Classification.of(support_request).questions({
    "urgent": Boolean("Does this request need an immediate response?", {
        "true": "Explicitly time-sensitive",
        "false": "No urgency expressed",
    }),
    "department": Choice("Which team should handle this request?", {
        "billing": "Payments, invoices, and refunds",
        "technical": "Bugs, outages, and integrations",
        "sales": "Pricing, plans, and upgrades",
    }),
    "frustration": Score("How frustrated is the customer?", ["Calm", "Frustrated", "Very angry"]),
}).classify()

result["urgent"]       # True
result.department      # "technical"
result["frustration"]  # 2
```

All questions go to the provider in one request. How they are answered depends on the provider:

| Provider | How it classifies | Confidence and probabilities |
|---|---|---|
| `google` | [Gemini Decisions API](https://aistudio.google.com/docs/decisions-api) with `gemini-decision-1` | Yes, calibrated by the API |
| `openai`, `anthropic`, `bedrock` | A structured-output [agent](/docs/ai/agent#structured-output) | No (`None`) |

The Decisions API scores each option instead of generating text, and it bills input tokens only.

## Configuration

Classification uses the same setup as [agents](/docs/ai/agent#configuration): register `AIProvider`, then pick the provider with `AI_PROVIDER`:

```ini
# .env
AI_PROVIDER=google
GEMINI_API_KEY=AIza...        # GOOGLE_API_KEY is also accepted

# Or any other chat provider:
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-...
```

The Google path only needs `httpx`, which the `ai` extra already installs. The other providers need their LangChain package, as for agents.

The Decisions model comes from the Google provider's `models.default_decisions` entry (`gemini-decision-1`):

```python
GoogleConfig(models={
    "default": "gemini-2.5-flash-lite",
    "default_decisions": "gemini-decision-1",
})
```

## Questions

Question keys may use letters, digits, `_` and `-`, up to 64 characters. This is the Decisions API's rule, and it applies to every provider so your questions stay portable. You can ask up to 1,000 questions at once.

A key may not name an attribute of the result: `model`, `provider`, `usage`, `state`, `answers`, `answer`, `to_dict`, `get`, `keys`, `items`, `values`, or a dunder name such as `__init__`. These raise `ValueError`, because `result.model` would return the model name instead of your answer. Use a key such as `model_name` instead.

### Boolean

A yes/no question. The answer is a `bool`. Descriptions for `true` and `false` are optional and help the model decide:

```python
Boolean("Did the item arrive damaged?")
Boolean("Is this spam?", {"true": "Unsolicited advertising", "false": "A real customer message"})
```

On Google, the answer is `True` when the API's probability of yes (`noul`) is at least 0.5.

### Choice

Picks exactly one option. The answer is the option's key. Give a description for each option, or pass a list of keys. You need 2 to 255 options. Each option key must be 1 to 128 characters (at most 512 bytes in UTF-8), with no leading or trailing whitespace and no control characters. These are the Decisions API's rules, and they apply to every provider.

```python
Choice("Which team should handle this request?", {
    "billing": "Payments, invoices, and refunds",
    "technical": "Bugs, outages, and integrations",
})
Choice("What language is this?", ["en", "de", "fr"])
```

### Score

Places the text on an ordered scale. List 2 to 255 levels from lowest to highest. The answer is the level's index, starting at `0`:

```python
Score("How frustrated is the customer?", ["Calm", "Frustrated", "Very angry"])
```

On Google, the answer is the level with the highest probability, so it always agrees with `answer.confidence`. On a tie, the lower level wins. The API also returns a probability-weighted average of the level indices, such as `1.1`; it stays in `answer.raw["score"]` and is only rounded to a level when the response has no probabilities. The average can point at a level the API rated unlikely: `{0: 0.45, 1: 0.0, 2: 0.55}` averages to `1.1`, but the answer is `2`.

Probabilities keyed by level text (`"Calm"`) are mapped to level indices like those keyed by index (`"0"`). A probability for an unknown level raises `ClassificationError`.

## Reading the Result

`classify()` returns a `ClassificationResult`. It is a read-only mapping from question key to answer value, and each value is also available as an attribute:

```python
result["department"]   # "technical"
result.department      # "technical"
result.to_dict()       # {"urgent": True, "department": "technical", "frustration": 2}
```

> Use `result["key"]` for keys that are not valid Python names (`first-contact`). Keys that would clash with the result's own attributes (`model`, `provider`, `usage`, `state`, `answers`, `answer`, `to_dict`, `get`, `keys`, `items`, `values`) are rejected when you call `questions()`, so `result.<key>` always returns your answer.

`result.answer(key)` returns the full `Answer`:

| Field | Description |
|---|---|
| `value` | `bool`, the chosen key, or the level index |
| `label` | The description of that value: the `Boolean` description (or `"true"`/`"false"`), the option's description (or its key), or the level text |
| `confidence` | The probability that the top answer is right. Google only, otherwise `None` |
| `probabilities` | Per-value probabilities: `{True: .., False: ..}`, `{key: ..}` or `{index: ..}`. Google only |
| `raw` | The provider's answer object as returned |

```python
answer = result.answer("frustration")
answer.label           # "Very angry"
answer.confidence      # 0.74
answer.probabilities   # {0: 0.02, 1: 0.24, 2: 0.74}
```

The result also carries `provider`, `model` and `usage` (`{"input": .., "output": ..}`, the same shape as [`state.usage()`](/docs/ai/agent#reading-the-result)). On the structured-output path, `result.state` holds the agent's turn.

## Choosing the Provider and Model

`classify()` takes the same `provider` and `model` overrides as agents:

```python
await classification.classify(provider="openai", model="gpt-4.1-mini")
await classification.classify(provider="google", model="gemini-decision-1")
```

On Google, `model` names a Decisions model, not a chat model such as `gemini-2.5-flash`.

## Errors

Building a classification raises `ValueError` for empty instructions or input, an empty question map, an invalid or reserved key, a value that is not a question, unknown `Boolean` description keys, an invalid `Choice` option key, and fewer than two choices or levels.

A bad answer raises `ClassificationError` (a `ValueError`) with the question's key in the message:

- an unknown choice, a score outside the scale, or a `Boolean` answer that is not `true`/`false`;
- a missing answer, or a Decisions answer of the wrong type;
- a structured reply that does not match the schema; the message includes the validation error and names the failing question;
- a failed Decisions API request, including safety blocks (`failed with 400: safety: ...`), network errors and timeouts (`request failed: ConnectError: ...`), and a response that is not a JSON object.

```python
from fastapi_startkit.ai.classification import ClassificationError

try:
    result = await classification.classify()
except ClassificationError as error:
    ...
```

## Testing

Both paths can be faked without calling a model.

On Google, `Decisions.fake()` replaces only the HTTP call. You still test the request your questions build and how the answers are read. Pass a list of response bodies, or a function that receives the payload. Each payload is recorded on `.requests`:

```python
from fastapi_startkit.ai.classification import Decisions

fake = Decisions.fake([{
    "answers": {
        "urgent": {"type": "noul", "noul": 0.97, "confidence": 0.97},
        "department": {"type": "choice", "choice": "technical", "probabilities": {"technical": 0.9, "billing": 0.1}},
    },
}])

result = await Classification.of(text).questions(questions).classify()

assert result.urgent is True
assert fake.requests[0]["questions"]["department"]["type"] == "choice"
```

Call `Decisions.reset_fake()` (or `Ai.reset_fakes()`) when the test ends.

For other providers, fake the `ClassificationAgent` like any [agent](/docs/ai/agent#faking-responses). The reply is a JSON object keyed by question, with `Score` answers given as level indices:

```python
from fastapi_startkit.ai.classification import ClassificationAgent

with ClassificationAgent.fake(['{"urgent": true, "department": "billing", "frustration": 1}']):
    result = await Classification.of(text).questions(questions).classify(provider="openai")
```

## See Also

- [Agents](/docs/ai/agent): structured output and testing
- [Embeddings](/docs/ai/embeddings)
- [Gemini Decisions API](https://aistudio.google.com/docs/decisions-api)
