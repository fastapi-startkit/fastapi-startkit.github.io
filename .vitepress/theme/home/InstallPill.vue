<script setup lang="ts">
    import { onBeforeUnmount, ref } from "vue"

    const props = withDefaults(defineProps<{
        command?: string
        tone?: "light" | "dark"
    }>(), { command: "uvx fastapi-startkit init my-app", tone: "light" })

    const copied = ref(false)
    let resetTimer: ReturnType<typeof setTimeout> | undefined

    async function copy() {
        try {
            await navigator.clipboard.writeText(props.command)
            copied.value = true
            clearTimeout(resetTimer)
            resetTimer = setTimeout(() => (copied.value = false), 1800)
        } catch {
            copied.value = false
        }
    }

    onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
    <div class="install" :class="`install--${tone}`">
        <code class="install__cmd"><span class="install__prompt" aria-hidden="true">$</span> {{ command }}</code>
        <button type="button" class="install__copy" @click="copy">
            {{ copied ? "Copied" : "Copy" }}
            <span class="sr-only" aria-live="polite">{{ copied ? "Command copied to clipboard" : "" }}</span>
        </button>
    </div>
</template>

<style scoped>
    .install {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        max-width: 100%;
        padding: 6px 6px 6px 16px;
        border: 1.5px solid var(--hp-line);
        border-radius: 12px;
        box-shadow: 4px 4px 0 var(--hp-shadow);
    }

    .install--light {
        background: var(--hp-card);
        color: var(--hp-ink);
    }

    .install--dark {
        background: #141312;
        color: #ece7dd;
        border-color: #141312;
        box-shadow: 4px 4px 0 #141312;
    }

    .install__cmd {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: 500 13px/1 var(--hp-mono);
        background: none;
        color: inherit;
        padding: 0;
    }

    .install__prompt {
        color: var(--hp-orange);
    }

    .install__copy {
        flex-shrink: 0;
        padding: 9px 14px;
        border-radius: 8px;
        border: 1.5px solid #111110;
        background: var(--hp-orange);
        color: #111110;
        font: 700 12px/1 var(--hp-mono);
        cursor: pointer;
        transition: transform 0.15s ease;
    }

    .install--dark .install__copy {
        background: #fbfaf7;
        border-color: #fbfaf7;
    }

    .install__copy:hover {
        transform: translate(-1px, -1px);
    }

    .install__copy:active {
        transform: translate(1px, 1px);
    }
</style>
