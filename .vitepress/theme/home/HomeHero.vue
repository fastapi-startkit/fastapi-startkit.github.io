<script setup lang="ts">
    import { Check } from "lucide-vue-next"
    import { computed, ref } from "vue"
    import CodeCard from "./CodeCard.vue"
    import InstallPill from "./InstallPill.vue"
    import { heroTabs } from "./snippets"

    const activeTab = ref(0)
    const activeFile = ref(0)
    const tab = computed(() => heroTabs[activeTab.value])
    const file = computed(() => tab.value.files[activeFile.value])

    function selectTab(index: number) {
        activeTab.value = index
        activeFile.value = 0
    }

    const highlights = ["Free & open source", "Async from the ground up", "Use one module or all"]
</script>

<template>
    <section class="hero" aria-labelledby="hero-title">
        <div class="hero__pattern" aria-hidden="true"></div>
        <div class="hp-wrap hero__grid">
            <div class="hero__copy">
                <p class="hero__badge">
                    <span class="hero__badge-tag">New</span>
                    MCP servers &amp; agent testing, built in
                </p>
                <h1 id="hero-title" class="hp-h1">
                    Laravel’s craft.<br>
                    FastAPI’s speed.<br>
                    <em>Ready for agents.</em>
                </h1>
                <p class="hero__lead">
                    A Python framework with service providers, an Artisan CLI, an ORM with migrations,
                    logging channels, MCP servers, and agent evals, all in one container.
                </p>
                <InstallPill/>
                <ul class="hero__checks">
                    <li v-for="item in highlights" :key="item">
                        <Check :size="13" :stroke-width="3" aria-hidden="true"/>
                        {{ item }}
                    </li>
                </ul>
            </div>

            <div class="hero__visual">
                <CodeCard :code="file.code" numbered class="hero__code">
                    <template #header>
                        <span class="hero__dots" aria-hidden="true"><i></i><i></i><i></i></span>
                        <div class="hero__tabs" role="group" aria-label="Example modules">
                            <button
                                v-for="(item, index) in heroTabs"
                                :key="item.tab"
                                type="button"
                                class="hero__tab"
                                :aria-pressed="activeTab === index"
                                @click="selectTab(index)"
                            >{{ item.tab }}</button>
                        </div>
                    </template>
                    <template #caption>
                        <div class="hero__files" role="group" :aria-label="`${tab.tab} files`">
                            <button
                                v-for="(item, index) in tab.files"
                                :key="item.path"
                                type="button"
                                class="hero__file"
                                :title="item.path"
                                :aria-pressed="activeFile === index"
                                @click="activeFile = index"
                            >{{ item.name }}</button>
                        </div>
                        <p class="hero__path">{{ file.path }}</p>
                    </template>
                </CodeCard>
                <span class="hero__sticker" aria-hidden="true">MCP<br>ready</span>
            </div>
        </div>
    </section>
</template>

<style scoped>
    .hero {
        position: relative;
        padding: 72px 0 96px;
        overflow: hidden;
        border-bottom: 1.5px solid var(--hp-line);
    }

    .hero__pattern {
        position: absolute;
        inset: 0;
        background-image: radial-gradient(color-mix(in srgb, var(--hp-orange) 42%, transparent) 1.4px, transparent 1.8px);
        background-size: 16px 16px;
        mask-image: radial-gradient(ellipse 60% 75% at 78% 45%, #000 20%, transparent 75%);
        -webkit-mask-image: radial-gradient(ellipse 60% 75% at 78% 45%, #000 20%, transparent 75%);
        opacity: 0.8;
    }

    .hero__grid {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
        gap: 56px;
        align-items: center;
    }

    .hero__badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 24px;
        padding: 4px 12px 4px 4px;
        border-radius: 999px;
        background: var(--hp-ink);
        color: var(--hp-bg);
        font: 600 12px/1.2 var(--hp-sans);
    }

    .hero__badge-tag {
        padding: 4px 8px;
        border-radius: 999px;
        background: var(--hp-orange);
        color: var(--hp-on-orange);
        font: 700 10px/1 var(--hp-mono);
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .hp-h1 {
        margin: 0;
        font: 800 clamp(2.6rem, 6.4vw, 4.9rem) / 0.95 var(--hp-sans);
        letter-spacing: -0.055em;
        color: var(--hp-ink);
    }

    .hp-h1 em {
        display: inline-block;
        margin-top: 0.06em;
    }

    .hero__lead {
        max-width: 470px;
        margin: 24px 0 28px;
        font-size: 16px;
        line-height: 1.6;
        color: var(--hp-ink-soft);
    }

    .hero__checks {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 22px;
        margin: 22px 0 0;
        padding: 0;
        list-style: none;
        font: 500 12px/1.4 var(--hp-sans);
        color: var(--hp-muted);
    }

    .hero__checks li {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .hero__checks svg {
        color: var(--hp-orange-ink);
    }

    .hero__visual {
        position: relative;
        padding: 20px 20px 0 0;
    }

    .hero__code {
        transform: rotate(-1.5deg);
        box-shadow: 8px 8px 0 var(--hp-orange);
    }

    .hero__code :deep(.code-card__body) {
        height: 432px;
        overflow-y: auto;
    }

    .hero__files {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 12px 20px 0;
    }

    .hero__file {
        padding: 5px 10px;
        border: 1px solid var(--hp-term-rule);
        border-radius: 6px;
        background: none;
        color: var(--hp-term-muted);
        font: 500 11px/1.2 var(--hp-mono);
        cursor: pointer;
    }

    .hero__file:hover {
        color: var(--hp-term-ink);
    }

    .hero__file[aria-pressed="true"] {
        border-color: var(--hp-orange);
        color: var(--hp-term-ink);
    }

    .hero__path {
        margin: 0;
        padding: 10px 20px 0;
        font: 500 11px/1.4 var(--hp-mono);
        color: var(--hp-term-muted);
        overflow-wrap: anywhere;
    }

    .hero__dots {
        display: inline-flex;
        gap: 6px;
        margin-right: 6px;
    }

    .hero__dots i {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--hp-term-rule);
    }

    .hero__tabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
    }

    .hero__tab {
        padding: 6px 12px;
        border-radius: 7px;
        border: 0;
        background: none;
        color: var(--hp-term-muted);
        font: 500 12px/1 var(--hp-mono);
        cursor: pointer;
        white-space: nowrap;
    }

    .hero__tab:hover {
        color: var(--hp-term-ink);
    }

    .hero__tab[aria-pressed="true"] {
        background: var(--hp-orange);
        color: #111110;
        font-weight: 700;
    }

    .hero__sticker {
        position: absolute;
        top: -6px;
        right: -4px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 92px;
        height: 92px;
        border-radius: 50%;
        background: var(--hp-orange);
        color: #111110;
        border: 1.5px solid #111110;
        box-shadow: 3px 3px 0 #111110;
        font: 800 15px/1 var(--hp-sans);
        letter-spacing: -0.03em;
        text-align: center;
        transform: rotate(14deg);
    }

    @media (max-width: 960px) {
        .hero__grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 48px;
        }

        .hero__pattern {
            mask-image: radial-gradient(ellipse 90% 50% at 60% 80%, #000 20%, transparent 75%);
            -webkit-mask-image: radial-gradient(ellipse 90% 50% at 60% 80%, #000 20%, transparent 75%);
        }
    }

    @media (max-width: 640px) {
        .hero {
            padding: 48px 0 64px;
        }

        .hero__visual {
            padding: 0 12px 24px 4px;
        }

        .hero__code {
            transform: rotate(-1deg);
            box-shadow: 6px 6px 0 var(--hp-orange);
        }

        .hero__code :deep(.code-card__body) {
            height: auto;
            max-height: 380px;
        }

        .hero__files,
        .hero__path {
            padding-left: 16px;
            padding-right: 16px;
        }

        .hero__tabs {
            flex-wrap: wrap;
            overflow-x: visible;
        }

        .hero__sticker {
            top: auto;
            bottom: -36px;
            right: 8px;
            width: 68px;
            height: 68px;
            font-size: 12px;
        }
    }
</style>
