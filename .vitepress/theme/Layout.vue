<script setup>
    import DefaultTheme from "vitepress/theme"
    import { useData } from "vitepress"
    import { computed } from "vue"
    import HomeNav from "./home/HomeNav.vue"
    import HomePage from "./home/HomePage.vue"
    import CourseHeader from "./tutorials/CourseHeader.vue"
    import CourseLessons from "./tutorials/CourseLessons.vue"
    import LessonAside from "./tutorials/LessonAside.vue"
    import LessonHeader from "./tutorials/LessonHeader.vue"
    import LessonNav from "./tutorials/LessonNav.vue"
    import TutorialsIndex from "./tutorials/TutorialsIndex.vue"

    const { Layout } = DefaultTheme
    const { frontmatter } = useData()
    const isHome = computed(() => frontmatter.value.layout === "home")
    const isTutorialsIndex = computed(() => frontmatter.value.tutorials === "index")
    const isCourse = computed(() => frontmatter.value.course === true)
    const isLesson = computed(() => typeof frontmatter.value.lesson === "number")
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
        <template #doc-after>
            <TutorialsIndex v-if="isTutorialsIndex"/>
            <CourseLessons v-else-if="isCourse"/>
            <LessonNav v-else-if="isLesson"/>
        </template>
        <template #aside-top>
            <LessonAside v-if="isLesson"/>
        </template>
    </Layout>
</template>
