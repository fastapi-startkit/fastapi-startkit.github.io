<script setup lang="ts">
    import { Moon, Search, Sun } from "lucide-vue-next"
    import { useData } from "vitepress"
    import { computed } from "vue"
    import BrandMark from "./BrandMark.vue"

    defineProps<{ fixed?: boolean }>()

    const { isDark, page } = useData()
    const inDocs = computed(() => page.value.relativePath.startsWith("docs/"))
    const inTutorials = computed(() => page.value.relativePath.startsWith("tutorials/"))

    function openSearch() {
        document.dispatchEvent(new KeyboardEvent("keydown", {
            key: "k", metaKey: true, ctrlKey: true, bubbles: true, cancelable: true,
        }))
    }
</script>

<template>
    <header class="hp-nav" :class="{ 'hp-nav--fixed': fixed }">
        <nav class="hp-nav__inner" aria-label="Main">
            <div class="hp-nav__left">
                <a href="/" class="hp-nav__brand" aria-label="FastAPI Startkit home">
                    <BrandMark/>
                </a>
                <a
                    href="/docs/getting-started"
                    class="hp-nav__link"
                    aria-label="Documentation"
                    :aria-current="inDocs ? 'true' : undefined"
                ><span class="hp-nav__link-full">Documentation</span><span class="hp-nav__link-short" aria-hidden="true">Docs</span></a>
                <a
                    href="/tutorials/"
                    class="hp-nav__link"
                    aria-label="Tutorials"
                    :aria-current="inTutorials ? 'true' : undefined"
                ><span class="hp-nav__link-full">Tutorials</span><span class="hp-nav__link-short" aria-hidden="true">Learn</span></a>
            </div>
            <div class="hp-nav__right">
                <button type="button" class="hp-nav__search" @click="openSearch">
                    <Search :size="15" aria-hidden="true"/>
                    <span class="hp-nav__search-text">Search docs…</span>
                    <kbd>⌘K</kbd>
                </button>
                <a
                    href="https://github.com/fastapi-startkit/fastapi-startkit"
                    target="_blank"
                    rel="noopener"
                    class="hp-nav__icon"
                    aria-label="FastAPI Startkit on GitHub"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                    </svg>
                </a>
                <button
                    type="button"
                    class="hp-nav__toggle"
                    :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
                    @click="isDark = !isDark"
                >
                    <Sun v-if="isDark" :size="16" aria-hidden="true"/>
                    <Moon v-else :size="16" aria-hidden="true"/>
                </button>
            </div>
        </nav>
    </header>
</template>

<style scoped>
    .hp-nav {
        position: sticky;
        top: 0;
        z-index: 100;
        height: var(--vp-nav-height, 64px);
        background: color-mix(in srgb, var(--hp-bg) 88%, transparent);
        backdrop-filter: blur(10px);
        border-bottom: 1.5px solid var(--hp-line);
    }

    .hp-nav--fixed {
        position: fixed;
        left: 0;
        right: 0;
    }

    .hp-nav--fixed .hp-nav__inner {
        max-width: var(--vp-layout-max-width, 1280px);
        padding: 0 32px;
    }

    .hp-nav__inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        height: 100%;
        max-width: 1140px;
        margin: 0 auto;
        padding: 0 var(--hp-gutter);
    }

    .hp-nav__left,
    .hp-nav__right {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .hp-nav__left {
        gap: 28px;
        min-width: 0;
    }

    .hp-nav__brand {
        display: inline-flex;
        text-decoration: none;
        color: var(--hp-ink);
    }

    .hp-nav__link {
        font: 600 13px/1 var(--hp-sans);
        color: var(--hp-ink-soft);
        text-decoration: none;
        transition: color 0.15s ease;
    }

    .hp-nav__link:hover,
    .hp-nav__link[aria-current] {
        color: var(--hp-orange-ink);
    }

    .hp-nav__link[aria-current] {
        text-decoration: underline;
        text-decoration-thickness: 2px;
        text-underline-offset: 6px;
    }

    .hp-nav__search {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: 220px;
        height: 36px;
        padding: 0 6px 0 12px;
        border: 1.5px solid var(--hp-line);
        border-radius: 10px;
        background: var(--hp-card);
        box-shadow: 3px 3px 0 var(--hp-shadow);
        color: var(--hp-muted);
        font: 500 12px/1 var(--hp-mono);
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .hp-nav__search:hover {
        transform: translate(-1px, -1px);
        box-shadow: 4px 4px 0 var(--hp-shadow);
    }

    .hp-nav__search:focus-visible {
        border-color: var(--hp-orange);
        box-shadow: 3px 3px 0 var(--hp-orange);
    }

    .hp-nav__search-text {
        flex: 1;
        text-align: left;
    }

    .hp-nav__search kbd {
        padding: 4px 6px;
        border-radius: 6px;
        background: var(--hp-orange);
        color: var(--hp-on-orange);
        font: 700 10px/1 var(--hp-mono);
    }

    .hp-nav__icon,
    .hp-nav__toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        color: var(--hp-ink);
        border-radius: 10px;
        background: none;
        border: 1.5px solid transparent;
        cursor: pointer;
    }

    .hp-nav__toggle {
        border-color: var(--hp-line);
        background: var(--hp-card);
        box-shadow: 3px 3px 0 var(--hp-shadow);
    }

    .hp-nav__icon:hover {
        color: var(--hp-orange-ink);
    }

    @media (prefers-reduced-motion: reduce) {
        .hp-nav__search {
            transition: none;
        }
    }

    @media (max-width: 760px) {
        .hp-nav--fixed .hp-nav__inner {
            padding: 0 var(--hp-gutter);
        }

        .hp-nav__search {
            width: 36px;
            padding: 0;
            justify-content: center;
        }

        .hp-nav__search-text,
        .hp-nav__search kbd {
            display: none;
        }
    }

    .hp-nav__link-short {
        display: none;
    }

    @media (max-width: 480px) {
        .hp-nav__link-full {
            display: none;
        }

        .hp-nav__link-short {
            display: inline;
        }
    }

    @media (max-width: 420px) {
        .hp-nav__left {
            gap: 14px;
        }

        .hp-nav__right {
            gap: 8px;
        }

        .hp-nav__icon {
            display: none;
        }
    }
</style>
