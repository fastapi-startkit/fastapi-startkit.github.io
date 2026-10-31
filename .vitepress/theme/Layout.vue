<script setup>
    import DefaultTheme from "vitepress/theme"
    import { useData } from "vitepress"
    import { computed } from "vue"
    import HomeNav from "./home/HomeNav.vue"
    import HomePage from "./home/HomePage.vue"
    import CourseHeader from "./tutorials/CourseHeader.vue"
    import LessonAside from "./tutorials/LessonAside.vue"
    import LessonHeader from "./tutorials/LessonHeader.vue"
    import TutorialsFooter from "./tutorials/TutorialsFooter.vue"

    const { Layout } = DefaultTheme
    const { frontmatter, page, theme } = useData()
    const isHome = computed(() => frontmatter.value.layout === "home")
    const isCourse = computed(() => frontmatter.value.course === true)
    const isLesson = computed(() => typeof frontmatter.value.lesson === "number")
    const isTutorialPage = computed(() => frontmatter.value.tutorials === "index" || isCourse.value || isLesson.value)
    const hasDocFooter = computed(() => Boolean(page.value.lastUpdated || theme.value.editLink))
</script>

<template>
    <Layout>
        <template #layout-top>
            <HomeNav :fixed="!isHome"/>
        </template>
        <template #home-hero-before>
            <HomePage/>
        </template>
        <template #doc-before>
            <CourseHeader v-if="isCourse"/>
            <LessonHeader v-else-if="isLesson"/>
        </template>
        <template #doc-footer-before>
            <TutorialsFooter v-if="isTutorialPage && hasDocFooter"/>
        </template>
        <template #doc-after>
            <TutorialsFooter v-if="isTutorialPage && !hasDocFooter"/>
        </template>
        <template #aside-top>
            <LessonAside v-if="isLesson"/>
        </template>
    </Layout>
</template>
