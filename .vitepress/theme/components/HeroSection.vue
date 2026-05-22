<script setup>
    import { computed, onMounted, onUnmounted, ref } from "vue"

    // ── Raw Python snippet imports ──────────────────────────────────────────────
    import applicationRaw from "../snippets/application.py?raw"
    import artisanRaw from "../snippets/artisan?raw"
    import dbMigrationsRaw from "../snippets/database_migrations.py?raw"
    import dbModelsRaw from "../snippets/database_models.py?raw"
    import fastapiRaw from "../snippets/fastapi.py?raw"
    import fastapiControllerRaw from "../snippets/fastapi_users_controller.py?raw"
    import fastapiRoutesRaw from "../snippets/fastapi_routes.py?raw"
    import logLoggerRaw from "../snippets/logging_logger.py?raw"

    // ── Word rotator ────────────────────────────────────────────────────────────
    const words = ["Engineers", "Startups", "Teams", "Builders"]
    const currentWord = ref(words[0])
    const isAnimating = ref(false)
    let wordIndex = 0
    let interval = null

    onMounted(() => {
        interval = setInterval(() => {
            isAnimating.value = true
            setTimeout(() => {
                wordIndex = (wordIndex + 1) % words.length
                currentWord.value = words[wordIndex]
                isAnimating.value = false
            }, 400)
        }, 3000)
    })
    onUnmounted(() => { if (interval) clearInterval(interval) })

    // ── Tab / file structure ────────────────────────────────────────────────────
    const categories = ["Application", "FastAPI", "Database", "Migrations", "Logging"]
    const activeCategory = ref("Application")
    const activeFileIndex = ref(0)
    const isTransitioning = ref(false)

    const tabData = {
        Application: { files: ["application.py", "artisan"], raw: [applicationRaw, artisanRaw] },
        FastAPI: { files: ["fastapi.py", "users_controllers.py", "api.py"], raw: [fastapiRaw, fastapiControllerRaw, fastapiRoutesRaw] },
        Database: { files: ["models.py", "migrations.py"], raw: [dbModelsRaw] },
        Migrations: { files: ["2026_04_26_110113_create_users.py"], raw: [dbMigrationsRaw] },
        Logging: { files: ["logging.py", "config.py"], raw: [logLoggerRaw] },
    }

    // ── Shiki highlighting ───────────────────────────────────────────────────────
    // highlighted[category][fileIndex] = inner HTML string from Shiki
    const highlighted = ref({})
    const highlighterReady = ref(false)

    onMounted(async () => {
        try {
            const { createHighlighter } = await import("shiki")
            const hl = await createHighlighter({
                themes: ["github-dark"],
                langs: ["python"],
            })

            const result = {}
            for (const [cat, data] of Object.entries(tabData)) {
                result[cat] = data.raw.map(code => {
                    const html = hl.codeToHtml(code, { lang: "python", theme: "github-dark" })
                    // Strip outer <pre ...><code> wrapper — we render inside our own pre/code
                    return html
                        .replace(/^<pre[^>]*><code[^>]*>/, "")
                        .replace(/<\/code><\/pre>$/, "")
                })
            }
            highlighted.value = result
            highlighterReady.value = true
        } catch (e) {
            console.warn("Shiki failed to load, falling back to plain text", e)
            highlighterReady.value = true
        }
    })

    const currentTabData = computed(() => tabData[activeCategory.value])

    const currentCode = computed(() => {
        if (!highlighterReady.value) return ""
        const h = highlighted.value[activeCategory.value]
        if (h) return h[activeFileIndex.value] ?? escapeHtml(currentTabData.value.raw[activeFileIndex.value])
        return escapeHtml(currentTabData.value.raw[activeFileIndex.value])
    })

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
    }

    function switchCategory(cat) {
        if (cat === activeCategory.value) return
        isTransitioning.value = true
        setTimeout(() => {
            activeCategory.value = cat
            activeFileIndex.value = 0
            isTransitioning.value = false
        }, 200)
    }

    function switchFile(index) {
        if (index === activeFileIndex.value) return
        isTransitioning.value = true
        setTimeout(() => {
            activeFileIndex.value = index
            isTransitioning.value = false
        }, 150)
    }
</script>

<template>
    <section id="hero-section" class="relative py-24 md:py-32 overflow-hidden border-b border-outline-variant bg-surface-container-lowest">
        <!-- Background glow -->
        <div class="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-150 h-150 bg-brand-teal/5 blur-[120px] rounded-full"></div>

        <div class="max-w-7xl mx-auto px-10 flex flex-col lg:flex-row items-center gap-16 lg:gap-24 relative z-10">

            <!-- Left Column -->
            <div class="flex-1 space-y-10">

                <!-- Badge -->
                <div class="inline-flex items-center gap-2 px-3 py-1 glass-teal rounded-full">
                    <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-teal opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-brand-teal"></span>
          </span>
                    <span class="text-label-sm font-label-sm text-brand-teal uppercase tracking-wider">Engineered for Performance</span>
                </div>

                <!-- Heading -->
                <h1 class="font-headline-xl text-headline-xl font-bold text-on-surface tracking-[-0.04em]">
                    The infrastructure layer for
                    <span
                        class="text-brand-teal text-glow inline-block transition-all duration-400"
                        :class="{ 'opacity-0 translate-y-2': isAnimating }"
                    >{{ currentWord }}</span>
                    <span class="text-brand-teal">.</span>
                </h1>

                <!-- Description -->
                <p class="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
                    FastAPI Startkit is a high-performance boilerplate engineered for speed. Batteries-included components designed to scale with your production requirements.
                </p>

                <!-- CTAs -->
                <div class="flex flex-col sm:flex-row gap-4">
                    <a href="/docs/getting-started" class="bg-brand-teal text-white px-8 py-4 rounded font-label-md font-bold flex items-center justify-center gap-2 transition-all hover:brightness-110 shadow-lg shadow-brand-teal/20 active:scale-[0.98]">
                        Initialize Project
                        <span class="material-symbols-outlined text-[18px]">terminal</span>
                    </a>
                </div>

                <!-- Stats -->
                <div class="grid grid-cols-3 gap-8 pt-8 border-t border-outline-variant">
                    <div>
                        <div class="text-headline-md font-headline-md font-semibold text-brand-teal tracking-[-0.01em]">99.9%</div>
                        <div class="text-label-sm font-label-sm text-on-surface-variant uppercase mt-1">Uptime SLA</div>
                    </div>
                    <div>
                        <div class="text-headline-md font-headline-md font-semibold text-brand-teal tracking-[-0.01em]">&lt;20ms</div>
                        <div class="text-label-sm font-label-sm text-on-surface-variant uppercase mt-1">P99 Latency</div>
                    </div>
                    <!--  <div>-->
                    <!--      <div class="text-headline-md font-headline-md font-semibold text-brand-teal tracking-[-0.01em]">12k+</div>-->
                    <!--      <div class="text-label-sm font-label-sm text-on-surface-variant uppercase mt-1">Stars</div>-->
                    <!--  </div>-->
                </div>
            </div>

            <!-- Right Column: Code Editor -->
            <div class="flex-[1.4] w-full min-w-0">
                <div class="flex flex-col items-center">

                    <!-- Category Tabs -->
                    <div class="inline-flex p-1 bg-surface-container-low rounded-full border border-outline-variant mb-6 w-full overflow-x-auto">
                        <button
                            v-for="cat in categories"
                            :key="cat"
                            class="flex-1 px-4 py-2 rounded-full font-label-md transition-all text-sm whitespace-nowrap"
                            :class="activeCategory === cat ? 'bg-brand-teal text-white' : 'text-on-surface-variant hover:text-brand-teal'"
                            @click="switchCategory(cat)"
                        >
                            {{ cat }}
                        </button>
                    </div>

                    <!-- Editor window -->
                    <div class="w-full bg-editor-bg rounded-xl border border-brand-teal/20 overflow-hidden code-shadow">

                        <!-- Chrome bar -->
                        <div class="flex items-center justify-between px-4 py-3 bg-editor-chrome border-b border-brand-teal/10">
                            <div class="flex items-center gap-6">
                                <!-- Traffic lights -->
                                <div class="flex gap-1.5">
                                    <div class="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                                    <div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                                    <div class="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                                </div>
                                <!-- File tabs -->
                                <div class="flex gap-4">
                                    <button
                                        v-for="(file, idx) in currentTabData.files"
                                        :key="file"
                                        class="px-3 py-1 flex items-center gap-2 rounded transition-all"
                                        :class="activeFileIndex === idx ? 'bg-brand-teal/10 border-b-2 border-brand-teal' : 'opacity-50 hover:opacity-75'"
                                        @click="switchFile(idx)"
                                    >
                                        <span class="material-symbols-outlined text-xs" :class="activeFileIndex === idx ? 'text-brand-teal' : 'text-outline-variant'">description</span>
                                        <span class="text-xs font-mono tracking-tight" :class="activeFileIndex === idx ? 'text-white' : 'text-outline-variant'">{{ file }}</span>
                                    </button>
                                </div>
                            </div>
                            <span class="material-symbols-outlined text-outline-variant text-sm hover:text-brand-teal cursor-pointer transition-colors">content_copy</span>
                        </div>

                        <!-- Code body -->
                        <div class="p-6 md:p-8 font-mono text-[13px] leading-relaxed h-[410px] overflow-y-auto overflow-x-hidden">
              <pre
                  class="text-white transition-all duration-200 m-0 p-0 bg-transparent"
                  :class="{ 'opacity-0 translate-y-1': isTransitioning }"
              ><code v-html="currentCode" class="bg-transparent"></code></pre>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
    /* Shiki injects spans with inline color styles — make sure the pre/code backgrounds are transparent */
    pre, code {
        background: transparent !important;
    }
</style>
