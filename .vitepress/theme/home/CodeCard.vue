<script setup lang="ts">
    import { computed } from "vue"
    import { highlight, type Lang } from "./highlight"

    const props = withDefaults(defineProps<{
        code: string
        lang?: Lang
        label?: string
        caption?: string
        numbered?: boolean
    }>(), { lang: "python", label: "", caption: "", numbered: false })

    const lines = computed(() => highlight(props.code, props.lang).split("\n"))
</script>

<template>
    <div class="code-card">
        <div v-if="label || $slots.header" class="code-card__head">
            <slot name="header">
                <span class="code-card__label">{{ label }}</span>
            </slot>
        </div>
        <slot name="caption">
            <p v-if="caption" class="code-card__caption">{{ caption }}</p>
        </slot>
        <pre class="code-card__body" :class="{ 'is-numbered': numbered }"><code><span v-for="(line, i) in lines" :key="i" class="code-card__line" v-html="line || ' '"></span></code></pre>
    </div>
</template>

<style scoped>
    .code-card {
        background: var(--hp-term);
        color: var(--hp-term-ink);
        border: 1.5px solid var(--hp-term-line);
        border-radius: 14px;
        overflow: hidden;
        min-width: 0;
    }

    .code-card__head {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 8px 16px;
        border-bottom: 1px solid var(--hp-term-rule);
    }

    .code-card__label {
        font: 500 11px/1.4 var(--hp-mono);
        color: var(--hp-term-muted);
        letter-spacing: 0.02em;
    }

    .code-card__caption {
        margin: 0;
        padding: 12px 20px 0;
        font: 500 11px/1.4 var(--hp-mono);
        color: var(--hp-term-muted);
    }

    .code-card__body {
        margin: 0;
        padding: 18px 20px;
        overflow-x: auto;
        font: 400 13px/1.75 var(--hp-mono);
        tab-size: 4;
    }

    .code-card__body code {
        display: block;
        min-width: max-content;
        font: inherit;
        color: inherit;
        background: none;
        padding: 0;
    }

    .code-card__line {
        display: block;
        white-space: pre;
    }

    .is-numbered code {
        counter-reset: line;
    }

    .is-numbered .code-card__line::before {
        counter-increment: line;
        content: counter(line);
        display: inline-block;
        width: 2ch;
        margin-right: 18px;
        text-align: right;
        color: var(--hp-term-muted);
        opacity: 0.6;
    }

    @media (max-width: 640px) {
        .code-card__body {
            padding: 14px 16px;
            font-size: 12px;
        }
    }
</style>
