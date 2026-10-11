<script setup>
    import DefaultTheme from "vitepress/theme"
    import { useData } from "vitepress"
    import { computed } from "vue"
    import HomeNav from "./home/HomeNav.vue"
    import HomePage from "./home/HomePage.vue"

    const { Layout } = DefaultTheme
    const { frontmatter } = useData()
    const isHome = computed(() => frontmatter.value.layout === "home")
</script>

<template>
    <Layout>
        <template #layout-top>
            <HomeNav :fixed="!isHome"/>
        </template>
        <template #home-hero-before>
            <HomePage/>
        </template>
    </Layout>
</template>
