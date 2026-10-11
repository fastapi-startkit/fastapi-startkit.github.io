<script setup lang="ts">
    import { Zap } from "lucide-vue-next"
</script>

<template>
    <span class="brand">
        <span class="brand__mark" aria-hidden="true">
            <Zap :size="15" :stroke-width="2.5" fill="currentColor"/>
        </span>
        <span class="brand__word"><span class="brand__fast">fastapi</span><span class="brand__kit">startkit</span><span class="brand__dot">.</span></span>
    </span>
</template>

<style scoped>
    .brand {
        display: inline-flex;
        align-items: center;
        gap: 9px;
    }

    .brand__mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 28px;
        height: 28px;
        border-radius: 7px;
        background: var(--hp-orange);
        color: #111110;
        border: 1.5px solid var(--hp-line);
        box-shadow: 2px 2px 0 var(--hp-shadow);
    }

    .brand__word {
        display: inline-flex;
        align-items: baseline;
        white-space: nowrap;
        line-height: 1;
    }

    .brand__fast {
        margin-right: 1px;
        font: italic 400 21px/1 var(--hp-serif);
        letter-spacing: -0.01em;
        color: var(--hp-orange-ink);
    }

    .brand__kit {
        font: 800 17px/1 var(--hp-sans);
        letter-spacing: -0.05em;
        color: var(--hp-ink);
    }

    .brand__dot {
        font: 800 17px/1 var(--hp-sans);
        color: var(--hp-orange);
    }
</style>
