<script setup lang="ts">
    import { Bot, Database, Globe, HardDrive, Layers, ScrollText, Zap } from "lucide-vue-next"
    import { computed, ref } from "vue"
    import CodeCard from "./CodeCard.vue"

    const providers = [
        { id: "logging", name: "Logging", detail: "terminal · daily · syslog · slack", icon: ScrollText, classes: ["LogProvider"], module: "fastapi_startkit.logging" },
        { id: "database", name: "Database & ORM", detail: "models · migrations · seeders", icon: Database, classes: ["DatabaseProvider"], module: "fastapi_startkit.masoniteorm" },
        { id: "http", name: "HTTP API", detail: "FastAPI · routers · resources", icon: Globe, classes: ["FastAPIProvider"], module: "fastapi_startkit.fastapi" },
        { id: "redis", name: "Redis", detail: "connections · key prefix · urls", icon: Zap, classes: ["RedisProvider"], module: "fastapi_startkit.redis" },
        { id: "storage", name: "Storage", detail: "local · public · s3 disks", icon: HardDrive, classes: ["StorageProvider"], module: "fastapi_startkit.storage" },
        { id: "ai", name: "AI & MCP", detail: "agents · MCP tools · evals", icon: Bot, classes: ["AIProvider", "McpProvider"], module: "" },
    ]

    const moduleOf: Record<string, string> = { AIProvider: "fastapi_startkit.ai", McpProvider: "fastapi_startkit.mcp" }

    const presets = [
        { name: "All providers", ids: providers.map((p) => p.id) },
        { name: "Background worker", ids: ["logging", "database", "redis"] },
        { name: "MCP server", ids: ["logging", "http", "ai"] },
    ]

    const enabled = ref(new Set(presets[0].ids))

    function isOn(id: string) {
        return enabled.value.has(id)
    }

    function toggle(id: string) {
        const next = new Set(enabled.value)
        next.has(id) ? next.delete(id) : next.add(id)
        enabled.value = next
    }

    function applyPreset(ids: string[]) {
        enabled.value = new Set(ids)
    }

    function isPresetActive(ids: string[]) {
        return ids.length === enabled.value.size && ids.every((id) => enabled.value.has(id))
    }

    const rows = computed(() => providers.flatMap((p) => p.classes.map((cls) => ({ cls, on: isOn(p.id) }))))
    const loaded = computed(() => rows.value.filter((row) => row.on))

    const code = computed(() => {
        const imports = providers
            .filter((p) => isOn(p.id))
            .flatMap((p) => p.classes.map((cls) => `from ${p.module || moduleOf[cls]} import ${cls}`))
        const list = loaded.value.length
            ? `[\n${loaded.value.map((row) => `        ${row.cls},`).join("\n")}\n    ]`
            : "[]"
        return [
            "from pathlib import Path",
            "from fastapi_startkit import Application",
            ...imports,
            "",
            "app = Application(",
            "    base_path=Path(__file__).parent.parent,",
            `    providers=${list},`,
            ")",
        ].join("\n")
    })

    const points = [
        { title: "Independent packages", text: "Each component has its own code and config, with no hard dependency on the others." },
        { title: "Connected by providers", text: "A provider registers the component in the app container. Nothing else connects them." },
        { title: "Pay only for what you load", text: "Skip a provider and its stack stays out of the process: a worker without FastAPIProvider never imports FastAPI." },
    ]
</script>

<template>
    <section class="hp-section" aria-labelledby="providers-title">
        <div class="hp-wrap">
            <div class="hp-head">
                <h2 id="providers-title" class="hp-h2">One core. <em>Everything else plugs in.</em></h2>
                <p class="hp-blurb">
                    Every component is an independent module with its own service provider. Register the provider
                    to wire in its config, container bindings, and lifecycle. Leave it out and it never loads.
                </p>
            </div>

            <div class="presets" role="group" aria-label="Try a setup">
                <span class="hp-label">Try a setup</span>
                <button
                    v-for="preset in presets"
                    :key="preset.name"
                    type="button"
                    class="hp-chip"
                    :aria-pressed="isPresetActive(preset.ids)"
                    @click="applyPreset(preset.ids)"
                >{{ preset.name }}</button>
            </div>

            <div class="hp-card board">
                <ul class="board__list" aria-label="Providers">
                    <li v-for="p in providers" :key="p.id" class="prov" :class="{ 'is-on': isOn(p.id) }">
                        <span class="prov__icon" aria-hidden="true"><component :is="p.icon" :size="16"/></span>
                        <span class="prov__text">
                            <span :id="`prov-${p.id}`" class="prov__name">{{ p.name }}</span>
                            <span class="prov__detail">{{ p.detail }}</span>
                        </span>
                        <button
                            type="button"
                            role="switch"
                            class="switch"
                            :aria-checked="isOn(p.id)"
                            :aria-labelledby="`prov-${p.id}`"
                            @click="toggle(p.id)"
                        ><span class="switch__knob"></span></button>
                    </li>
                </ul>

                <div class="app-box">
                    <div class="app-box__head">
                        <span class="app-box__icon" aria-hidden="true"><Layers :size="16"/></span>
                        <div>
                            <p class="app-box__title">Application</p>
                            <p class="app-box__sub">fastapi_startkit · container</p>
                        </div>
                    </div>
                    <ul class="app-box__rows">
                        <li v-for="row in rows" :key="row.cls" class="app-row" :class="{ 'is-on': row.on }">
                            <span>{{ row.cls }}</span>
                            <span class="app-row__state">{{ row.on ? "loaded" : "not loaded" }}</span>
                        </li>
                    </ul>
                    <p class="app-box__foot" aria-live="polite">
                        {{ loaded.length }} of {{ rows.length }} providers loaded · {{ rows.length - loaded.length }} skipped
                    </p>
                </div>
            </div>

            <div class="below">
                <CodeCard :code="code" label="bootstrap/application.py · updates as you toggle"/>
                <ol class="points">
                    <li v-for="(point, index) in points" :key="point.title">
                        <span class="points__num" aria-hidden="true">{{ index + 1 }}</span>
                        <div>
                            <p class="points__title">{{ point.title }}</p>
                            <p class="points__text">{{ point.text }}</p>
                        </div>
                    </li>
                </ol>
            </div>
        </div>
    </section>
</template>

<style scoped>
    .presets {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
    }

    .presets .hp-label {
        margin-right: 6px;
    }

    .board {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 48px;
        padding: 24px;
        border-radius: 20px;
        box-shadow: 6px 6px 0 var(--hp-shadow);
    }

    .board__list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .prov {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border: 1.5px dashed var(--hp-line-soft);
        border-radius: 12px;
        background: var(--hp-card-off);
        transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .prov::after {
        content: "";
        position: absolute;
        top: 50%;
        left: calc(100% + 1.5px);
        width: 48px;
        border-top: 1.5px dashed var(--hp-line-soft);
    }

    .prov.is-on {
        border: 1.5px solid var(--hp-line);
        background: var(--hp-card);
        box-shadow: 3px 3px 0 var(--hp-shadow);
    }

    .prov.is-on::after {
        border-top: 2px solid var(--hp-orange);
    }

    .prov__icon {
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 9px;
        background: var(--hp-line-soft);
        color: var(--hp-muted);
    }

    .prov.is-on .prov__icon {
        background: var(--hp-term);
        color: var(--hp-orange);
    }

    .prov__text {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
    }

    .prov__name {
        font: 700 14px/1.2 var(--hp-sans);
        color: var(--hp-ink);
    }

    .prov:not(.is-on) .prov__name {
        color: var(--hp-muted);
    }

    .prov__detail {
        font: 400 11px/1.3 var(--hp-mono);
        color: var(--hp-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .switch {
        position: relative;
        flex-shrink: 0;
        width: 44px;
        height: 24px;
        padding: 0;
        border: 1.5px solid var(--hp-muted);
        border-radius: 999px;
        background: var(--hp-card);
        cursor: pointer;
        transition: background 0.2s ease, border-color 0.2s ease;
    }

    .switch__knob {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 17px;
        height: 17px;
        border-radius: 50%;
        background: var(--hp-muted);
        transition: transform 0.2s ease, background 0.2s ease;
    }

    .switch[aria-checked="true"] {
        background: var(--hp-orange);
        border-color: var(--hp-line);
    }

    .switch[aria-checked="true"] .switch__knob {
        transform: translateX(20px);
        background: #111110;
    }

    .app-box {
        display: flex;
        flex-direction: column;
        padding: 18px;
        border-radius: 14px;
        background: var(--hp-term);
        color: var(--hp-term-ink);
        border: 1.5px solid var(--hp-term-line);
    }

    .app-box__head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    .app-box__head p {
        margin: 0;
    }

    .app-box__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 9px;
        background: var(--hp-orange);
        color: #111110;
    }

    .app-box__title {
        font: 800 18px/1.1 var(--hp-sans);
        letter-spacing: -0.03em;
    }

    .app-box__sub {
        font: 400 11px/1.4 var(--hp-mono);
        color: var(--hp-term-muted);
    }

    .app-box__rows {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .app-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 9px 12px;
        border: 1px dashed var(--hp-term-rule);
        border-radius: 8px;
        font: 500 12px/1.2 var(--hp-mono);
        color: var(--hp-term-muted);
        transition: background 0.2s ease, color 0.2s ease;
    }

    .app-row.is-on {
        border: 1px solid var(--hp-orange);
        background: var(--hp-orange);
        color: #111110;
        font-weight: 700;
    }

    .app-row__state {
        font-size: 11px;
        opacity: 0.85;
    }

    .app-box__foot {
        margin: 16px 0 0;
        padding-top: 12px;
        border-top: 1px solid var(--hp-term-rule);
        font: 400 11px/1.4 var(--hp-mono);
        color: var(--hp-term-muted);
    }

    .below {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
        gap: 40px;
        align-items: start;
        margin-top: 32px;
    }

    .points {
        display: flex;
        flex-direction: column;
        gap: 22px;
        margin: 0;
        padding: 12px 0 0;
        list-style: none;
    }

    .points li {
        display: flex;
        gap: 14px;
    }

    .points p {
        margin: 0;
    }

    .points__num {
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: var(--hp-orange);
        color: #111110;
        border: 1.5px solid var(--hp-line);
        font: 700 12px/1 var(--hp-mono);
    }

    .points__title {
        font: 700 15px/1.3 var(--hp-sans);
        color: var(--hp-ink);
    }

    .points__text {
        margin-top: 4px !important;
        font-size: 13px;
        line-height: 1.55;
        color: var(--hp-ink-soft);
    }

    @media (max-width: 900px) {
        .board,
        .below {
            grid-template-columns: minmax(0, 1fr);
        }

        .board {
            gap: 28px;
        }

        .prov::after {
            display: none;
        }
    }

    @media (max-width: 640px) {
        .board {
            padding: 14px;
        }

        .prov {
            padding: 10px;
        }
    }
</style>
