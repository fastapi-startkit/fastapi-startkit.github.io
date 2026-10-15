<script setup lang="ts">
    import InstallPill from "./InstallPill.vue"
</script>

<template>
    <section class="cta" aria-labelledby="cta-title">
        <div class="hp-wrap cta__inner">
            <h2 id="cta-title" class="cta__title">Start with one provider. <em>Add the rest as you need them.</em></h2>
            <div class="cta__actions">
                <InstallPill tone="dark"/>
                <a href="/docs/getting-started" class="cta__docs">Read the docs <span aria-hidden="true">→</span></a>
            </div>
            <p class="cta__meta">Free and open source · Python 3.12+ · contributions welcome</p>
        </div>
    </section>
</template>

<style scoped>
    .cta {
        padding: 112px 0;
        background: var(--hp-orange);
        color: #111110;
        border-top: 1.5px solid #111110;
    }

    .cta__inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .cta__title {
        max-width: 760px;
        margin: 0;
        font: 800 clamp(2.5rem, 6.5vw, 4.75rem) / 0.95 var(--hp-sans);
        letter-spacing: -0.055em;
        color: #111110;
    }

    .cta__title em {
        font-family: var(--hp-serif);
        font-style: italic;
        font-weight: 400;
        letter-spacing: -0.025em;
    }

    .cta__actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 16px;
        max-width: 100%;
        margin-top: 36px;
    }

    .cta__docs {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 14px 20px;
        border: 1.5px solid #111110;
        border-radius: 12px;
        background: #fbfaf7;
        color: #111110 !important;
        box-shadow: 4px 4px 0 #111110;
        font: 700 14px/1 var(--hp-sans);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .cta__docs:hover {
        transform: translate(-2px, -2px);
        box-shadow: 6px 6px 0 #111110;
    }

    .cta :deep(:focus-visible) {
        outline-color: #111110;
    }

    .cta__meta {
        margin: 24px 0 0;
        font: 500 12px/1.5 var(--hp-mono);
        color: #2a1309;
    }

    @media (max-width: 640px) {
        .cta {
            padding: 72px 0;
        }
    }
</style>
