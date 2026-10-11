<template>
    <span class="brand">
        <span class="brand__mark" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </span>
        <span class="brand__word"><span class="brand__fast">fastapi</span><span class="brand__kit">startkit</span></span>
    </span>
</template>

<style scoped>
    .brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .brand__mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 7px;
        background: var(--hp-orange);
        color: var(--hp-on-orange);
        border: 1.5px solid var(--hp-line);
        box-shadow: 2px 2px 0 var(--hp-shadow);
    }

    .brand__word {
        display: inline-flex;
        align-items: baseline;
        gap: 2px;
        white-space: nowrap;
    }

    .brand__fast {
        font: italic 400 19px/1 var(--hp-serif);
        color: var(--hp-orange);
    }

    .brand__kit {
        font: 800 16px/1 var(--hp-sans);
        letter-spacing: -0.04em;
        color: var(--hp-ink);
    }
</style>
