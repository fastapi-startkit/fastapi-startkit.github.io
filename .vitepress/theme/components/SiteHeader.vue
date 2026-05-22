<script setup>
    import { Menu, Moon, Search, Sun, X, Zap } from "lucide-vue-next"
    import { useData } from "vitepress"
    import { computed, onMounted, onUnmounted, ref, watch } from "vue"

    const { page, isDark } = useData()

    function toggleDark() {
        isDark.value = !isDark.value
    }
    const currentPath = computed(() => page.value.relativePath)

    const mobileMenuOpen = ref(false)
    const menuButtonRef = ref(null)

    function onDocClick(e) {
        if (mobileMenuOpen.value && menuButtonRef.value && !menuButtonRef.value.contains(e.target)) {
            mobileMenuOpen.value = false
        }
    }

    onMounted(() => document.addEventListener("click", onDocClick))
    onUnmounted(() => document.removeEventListener("click", onDocClick))

    // Close menu on SPA navigation
    watch(currentPath, () => { mobileMenuOpen.value = false })

    function isActive(href) {
        if (href === "/") return currentPath.value === "index.md"
        return currentPath.value.startsWith(href.replace(/^\//, ""))
    }

    function openSearch() {
        mobileMenuOpen.value = false
        document.dispatchEvent(new KeyboardEvent("keydown", {
            key: "k", metaKey: true, ctrlKey: true, bubbles: true, cancelable: true,
        }))
    }

    function handleMenuToggle() {
        mobileMenuOpen.value = !mobileMenuOpen.value
    }
</script>

<template>
    <header class="w-full h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant fixed top-0 left-0 right-0 z-[100]">
        <nav class="flex justify-between items-center h-full max-w-7xl mx-auto px-6 md:px-10">

            <!-- Left: Logo + desktop nav links -->
            <div class="flex items-center gap-8 md:gap-12">
                <a href="/" class="font-headline-md font-bold text-brand-teal tracking-tight flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0">
                    <Zap :size="20"/>
                    <span>FastAPI Startkit</span>
                </a>

                <!-- Desktop nav links (md+) -->
                <div class="hidden md:flex gap-8 items-center h-full">
                    <a
                        href="/docs/getting-started"
                        class="transition-colors text-label-md font-label-md"
                        :class="isActive('/docs') ? 'text-brand-teal' : 'text-on-surface-variant hover:text-brand-teal'"
                    >Documentation</a>
                </div>
            </div>

            <!-- Right -->
            <div class="flex items-center gap-2 md:gap-4">

                <!-- Full search bar — desktop only -->
                <button
                    class="hidden lg:flex items-center px-4 py-1.5 border border-outline-variant bg-surface-container-low rounded hover:border-brand-teal transition-all cursor-text"
                    @click="openSearch"
                >
                    <span class="text-on-surface-variant text-label-md font-label-md flex items-center gap-2">
                        <Search :size="16"/>
                        Search docs...
                    </span>
                    <span class="ml-4 text-[10px] text-outline font-label-sm border border-outline-variant px-1.5 py-0.5 rounded bg-white">⌘K</span>
                </button>

                <!-- GitHub icon — desktop only -->
                <a
                    href="https://github.com/fastapi-startkit/fastapi_startkit"
                    target="_blank"
                    rel="noopener"
                    class="hidden md:block text-on-surface-variant hover:text-brand-teal transition-colors"
                    aria-label="GitHub"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                    </svg>
                </a>

                <!-- Dark mode toggle -->
                <button
                    class="flex items-center justify-center w-9 h-9 rounded border border-outline-variant bg-surface-container-low hover:border-brand-teal transition-all"
                    @click="toggleDark"
                    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
                >
                    <Sun v-if="isDark" :size="18" class="text-on-surface-variant"/>
                    <Moon v-else :size="18" class="text-on-surface-variant"/>
                </button>

                <!-- Mobile menu toggle -->
                <button
                    ref="menuButtonRef"
                    class="md:hidden flex items-center justify-center w-9 h-9 rounded border border-outline-variant bg-surface-container-low hover:border-brand-teal transition-all"
                    @click.stop="handleMenuToggle"
                    aria-label="Toggle menu"
                >
                    <X v-if="mobileMenuOpen" :size="18" class="text-on-surface-variant"/>
                    <Menu v-else :size="18" class="text-on-surface-variant"/>
                </button>

            </div>

        </nav>

        <!-- Mobile nav dropdown -->
        <div
            v-if="mobileMenuOpen"
            class="md:hidden absolute top-full left-0 right-0 bg-surface/95 backdrop-blur-md border-b border-outline-variant shadow-lg"
        >
            <div class="flex flex-col px-6 py-4 gap-1 max-w-[1280px] mx-auto">
                <a
                    href="/docs/getting-started"
                    class="text-body-md font-body-md transition-colors py-3 border-b border-outline-variant"
                    :class="isActive('/docs') ? 'text-brand-teal' : 'text-on-surface'"
                    @click="mobileMenuOpen = false"
                >Documentation</a>
                <button
                    class="text-body-md font-body-md text-on-surface hover:text-brand-teal transition-colors py-3 border-b border-outline-variant flex items-center gap-2 w-full text-left"
                    @click="openSearch"
                >
                    <Search :size="18"/>
                    Search
                </button>
                <a
                    href="https://github.com/fastapi-startkit/fastapi_startkit"
                    target="_blank"
                    rel="noopener"
                    class="text-body-md font-body-md text-on-surface hover:text-brand-teal transition-colors py-3 flex items-center gap-2"
                    @click="mobileMenuOpen = false"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                    </svg>
                    GitHub
                </a>
            </div>
        </div>
    </header>
</template>
