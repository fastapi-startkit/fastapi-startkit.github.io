<script setup>
    import DefaultTheme from "vitepress/theme"
    import { useData } from "vitepress"
    import { computed } from "vue"
    import SiteHeader from "./components/SiteHeader.vue"
    import HomeNav from "./home/HomeNav.vue"
    import HomePage from "./home/HomePage.vue"

    const { Layout } = DefaultTheme
    const { frontmatter } = useData()
    const isHome = computed(() => frontmatter.value.layout === "home")
</script>

<template>
    <Layout>
        <template #layout-top>
            <HomeNav v-if="isHome"/>
            <SiteHeader v-else/>
        </template>
        <template #home-hero-before>
            <HomePage/>
        </template>
    </Layout>
</template>
