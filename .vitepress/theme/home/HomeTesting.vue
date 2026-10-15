<script setup lang="ts">
    import { computed } from "vue"
    import { highlight } from "./highlight"
    import { agentTestSnippet } from "./snippets"

    const helpers = [
        { name: ".fake([...])", text: "Deterministic replies, no API calls" },
        { name: ".record()", text: "Record once, replay from a cassette" },
        { name: "assert_tool_called()", text: "The agent called the right tool" },
        { name: "assert_response_judged()", text: "LLM-graded answer quality" },
    ]

    const code = computed(() => highlight(agentTestSnippet))
</script>

<template>
    <section class="testing" aria-labelledby="testing-title">
        <div class="hp-wrap testing__grid">
            <div>
                <span class="hp-label testing__label">07 / testing</span>
                <h2 id="testing-title" class="hp-h2 testing__title">Test agents like <em>you test routes.</em></h2>
                <p class="testing__lead">
                    Fake or record any agent, assert on the tools it called, and grade answers with an LLM judge,
                    all in the test runner you already use. Cassettes keep CI fast and offline.
                </p>
                <dl class="helpers">
                    <div v-for="helper in helpers" :key="helper.name" class="helpers__row">
                        <dt><code>{{ helper.name }}</code></dt>
                        <dd>{{ helper.text }}</dd>
                    </div>
                </dl>
                <a href="/docs/ai/agent#testing" class="testing__link">Agent testing docs →</a>
            </div>

            <div class="test-card">
                <div class="test-card__head">tests/test_support_agent.py</div>
                <pre class="test-card__code"><code v-html="code"></code></pre>
                <div class="test-card__run">
                    <code><span aria-hidden="true">$ </span>uv run pytest tests/test_support_agent.py</code>
                    <code class="test-card__pass">✓ 1 passed</code>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
    .testing {
        padding: 112px 0;
        background: var(--hp-term);
        color: #f3efe7;
        border-top: 1.5px solid var(--hp-line);
        border-bottom: 1.5px solid var(--hp-line);
    }

    .testing__grid {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        gap: 64px;
        align-items: center;
    }

    .testing__label {
        margin-bottom: 18px;
        color: #9a9488;
    }

    .testing__title {
        color: #f3efe7;
    }

    .testing__lead {
        max-width: 440px;
        margin: 22px 0 28px;
        font-size: 14.5px;
        line-height: 1.6;
        color: #cdc7bb;
    }

    .helpers {
        margin: 0;
    }

    .helpers__row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 13px 0;
        border-bottom: 1px solid #2b2926;
    }

    .helpers dt code {
        font: 600 12.5px/1.3 var(--hp-mono);
        color: var(--hp-orange);
        background: none;
        padding: 0;
    }

    .helpers dd {
        margin: 0;
        font-size: 12.5px;
        color: #a49d91;
        text-align: right;
    }

    .testing__link {
        display: inline-block;
        margin-top: 24px;
        font: 700 13px/1 var(--hp-sans);
        color: #f3efe7;
        border-bottom: 2px solid var(--hp-orange);
        padding-bottom: 4px;
    }

    .test-card {
        min-width: 0;
        border: 1.5px solid #fbfaf7;
        border-radius: 16px;
        overflow: hidden;
        background: #fbfaf7;
        color: #111110;
        box-shadow: 8px 8px 0 var(--hp-orange);
        transform: rotate(1.2deg);
    }

    .test-card__head {
        padding: 12px 18px;
        border-bottom: 1.5px solid #e4ded2;
        font: 500 11px/1.4 var(--hp-mono);
        color: #6b665d;
    }

    .test-card__code {
        margin: 0;
        padding: 18px;
        overflow-x: auto;
        font: 400 12.5px/1.75 var(--hp-mono);
    }

    .test-card__code code {
        font: inherit;
        color: inherit;
        background: none;
        padding: 0;
        white-space: pre;
    }

    .test-card__run {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px 18px;
        background: #141312;
        overflow-x: auto;
    }

    .test-card__run code {
        font: 500 12px/1.4 var(--hp-mono);
        color: #ece7dd;
        background: none;
        padding: 0;
        white-space: nowrap;
    }

    .test-card__run span {
        color: var(--hp-orange);
    }

    .test-card__pass {
        color: #9fe08a !important;
    }

    .test-card :deep(.tk-k) { color: #b4461b; }
    .test-card :deep(.tk-s) { color: #2f7a27; }
    .test-card :deep(.tk-c) { color: #7a756c; }
    .test-card :deep(.tk-t) { color: #1d5fb8; }
    .test-card :deep(.tk-f) { color: #7c3aed; }
    .test-card :deep(.tk-n) { color: #9a5b00; }

    @media (max-width: 900px) {
        .testing {
            padding: 80px 0;
        }

        .testing__grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 48px;
        }

        .test-card {
            transform: none;
        }
    }

    @media (max-width: 640px) {
        .testing {
            padding: 64px 0;
        }

        .helpers__row {
            flex-direction: column;
            gap: 4px;
        }

        .helpers dd {
            text-align: left;
        }
    }
</style>
