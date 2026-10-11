<script setup lang="ts">
    import { ArrowRight } from "lucide-vue-next"
    import { computed, nextTick, ref } from "vue"
    import { highlight } from "./highlight"
    import { comparisons } from "./snippets"

    const active = ref(0)
    const tabs = ref<HTMLButtonElement[]>([])
    const current = computed(() => comparisons[active.value])
    const laravelHtml = computed(() => highlight(current.value.laravel.code, current.value.lang === "bash" ? "bash" : "php"))
    const startkitHtml = computed(() => highlight(current.value.startkit.code, current.value.lang))

    async function select(index: number) {
        active.value = (index + comparisons.length) % comparisons.length
        await nextTick()
        tabs.value[active.value]?.focus()
    }

    function onKeydown(event: KeyboardEvent) {
        const moves: Record<string, number> = { ArrowRight: active.value + 1, ArrowLeft: active.value - 1, Home: 0, End: comparisons.length - 1 }
        if (event.key in moves) {
            event.preventDefault()
            select(moves[event.key])
        }
    }
</script>

<template>
    <section class="hp-section" aria-labelledby="laravel-title">
        <div class="hp-wrap">
            <div class="hp-head">
                <h2 id="laravel-title" class="hp-h2">Coming from Laravel? <em>You already know it.</em></h2>
                <p class="hp-blurb">Same ideas, same names, same muscle memory — just Python. Pick a concept and compare.</p>
            </div>

            <div class="tabs" role="tablist" aria-label="Compare a concept" @keydown="onKeydown">
                <button
                    v-for="(item, index) in comparisons"
                    :id="`cmp-tab-${index}`"
                    :key="item.tab"
                    ref="tabs"
                    type="button"
                    role="tab"
                    class="hp-chip"
                    :aria-selected="active === index"
                    :tabindex="active === index ? 0 : -1"
                    aria-controls="cmp-panel"
                    @click="select(index)"
                >{{ item.tab }}</button>
            </div>

            <div id="cmp-panel" role="tabpanel" :aria-labelledby="`cmp-tab-${active}`" class="compare">
                <div class="side side--laravel hp-light-code">
                    <div class="side__head">
                        <span class="side__name side__name--serif">Laravel</span>
                        <span class="side__path">{{ current.laravel.path }}</span>
                    </div>
                    <pre class="side__code"><code v-html="laravelHtml"></code></pre>
                </div>
                <span class="compare__arrow" aria-hidden="true"><ArrowRight :size="18" :stroke-width="2.5"/></span>
                <div class="side side--startkit">
                    <div class="side__head">
                        <span class="side__name">Startkit</span>
                        <span class="side__path">{{ current.startkit.path }}</span>
                    </div>
                    <pre class="side__code"><code v-html="startkitHtml"></code></pre>
                </div>
            </div>
            <p class="compare__note"><span aria-hidden="true">●</span> {{ current.note }}</p>
        </div>
    </section>
</template>

<style scoped>
    .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
    }

    .compare {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 28px;
    }

    .side {
        min-width: 0;
        border: 1.5px solid var(--hp-line);
        border-radius: 16px;
        overflow: hidden;
    }

    .side--laravel {
        background: var(--hp-card);
        color: var(--hp-ink);
        box-shadow: 4px 4px 0 var(--hp-shadow);
    }

    .side--startkit {
        background: var(--hp-term);
        color: var(--hp-term-ink);
        border-color: var(--hp-term-line);
        box-shadow: 6px 6px 0 var(--hp-orange);
    }

    .side__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px 18px;
        border-bottom: 1.5px dashed var(--hp-line-soft);
    }

    .side--startkit .side__head {
        border-bottom: 1px solid var(--hp-term-rule);
    }

    .side__name {
        font: 800 15px/1 var(--hp-sans);
        letter-spacing: -0.02em;
    }

    .side__name--serif {
        font: italic 400 19px/1 var(--hp-serif);
    }

    .side__path {
        font: 400 11px/1.3 var(--hp-mono);
        color: var(--hp-muted);
        text-align: right;
        overflow-wrap: anywhere;
    }

    .side--startkit .side__path {
        color: var(--hp-term-muted);
    }

    .side__code {
        margin: 0;
        padding: 20px 18px;
        min-height: 170px;
        overflow-x: auto;
        font: 400 12.5px/1.75 var(--hp-mono);
    }

    .side__code code {
        font: inherit;
        color: inherit;
        background: none;
        padding: 0;
        white-space: pre;
    }

    .compare__arrow {
        position: absolute;
        top: 50%;
        left: 50%;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--hp-orange);
        color: #111110;
        border: 1.5px solid var(--hp-line);
        box-shadow: 2px 2px 0 var(--hp-shadow);
        transform: translate(-50%, -50%);
    }

    .compare__note {
        margin: 18px 0 0;
        font: 500 12px/1.5 var(--hp-mono);
        color: var(--hp-ink-soft);
    }

    .compare__note span {
        color: var(--hp-orange);
        margin-right: 4px;
    }

    @media (max-width: 800px) {
        .compare {
            grid-template-columns: minmax(0, 1fr);
        }

        .compare__arrow {
            transform: translate(-50%, -50%) rotate(90deg);
        }

        .side__code {
            min-height: 0;
        }
    }
</style>
