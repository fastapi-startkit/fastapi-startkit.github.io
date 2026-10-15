<script setup lang="ts">
    import { ArrowRight } from "lucide-vue-next"
    import CodeCard from "./CodeCard.vue"
    import { mcpToolSnippet } from "./snippets"

    const pills = ["Order model", "config", "logging", "database"]
</script>

<template>
    <section class="hp-section" aria-labelledby="agents-title">
        <div class="hp-wrap">
            <div class="hp-head">
                <h2 id="agents-title" class="hp-h2">Your app, <em>callable by agents.</em></h2>
                <p class="hp-blurb">
                    Subclass <code>Tool</code> and give it a Pydantic schema to make it an MCP tool. It is served at
                    <code>POST /mcp</code> beside your HTTP routes, with the same config, models, and logs.
                </p>
            </div>

            <ol class="flow">
                <li class="hp-card step">
                    <span class="hp-label">agent</span>
                    <p class="step__quote">“Summarize yesterday’s orders”</p>
                </li>
                <li class="flow__arrow" aria-hidden="true"><ArrowRight :size="18"/></li>
                <li class="step step--code">
                    <CodeCard :code="mcpToolSnippet" label="mcp tool · app/mcp/tools.py"/>
                </li>
                <li class="flow__arrow" aria-hidden="true"><ArrowRight :size="18"/></li>
                <li class="hp-card step">
                    <span class="hp-label">your app</span>
                    <ul class="step__pills">
                        <li v-for="pill in pills" :key="pill">{{ pill }}</li>
                    </ul>
                </li>
            </ol>
        </div>
    </section>
</template>

<style scoped>
    .hp-blurb code {
        font: 500 12px/1 var(--hp-mono);
        padding: 2px 5px;
        border-radius: 5px;
        background: var(--hp-bg-alt);
        color: var(--hp-ink);
    }

    .flow {
        display: grid;
        grid-template-columns: minmax(0, 0.8fr) auto minmax(0, 1.5fr) auto minmax(0, 0.8fr);
        align-items: center;
        gap: 16px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .step {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
        padding: 20px;
        min-height: 150px;
    }

    .step--code {
        padding: 0;
    }

    .step--code :deep(.code-card) {
        box-shadow: 6px 6px 0 var(--hp-orange);
    }

    .step--code :deep(.code-card__body) {
        font-size: 12px;
    }

    .step__quote {
        margin: 0;
        font: italic 400 24px/1.15 var(--hp-serif);
        color: var(--hp-ink);
    }

    .step__pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .step__pills li {
        padding: 6px 10px;
        border: 1.5px solid var(--hp-line);
        border-radius: 999px;
        font: 500 11px/1 var(--hp-mono);
        color: var(--hp-ink);
    }

    .flow__arrow {
        display: inline-flex;
        color: var(--hp-orange-ink);
    }

    @media (max-width: 1000px) {
        .flow {
            grid-template-columns: minmax(0, 1fr);
            justify-items: stretch;
        }

        .flow__arrow {
            justify-self: center;
            transform: rotate(90deg);
        }

        .step {
            min-height: 0;
        }
    }
</style>
