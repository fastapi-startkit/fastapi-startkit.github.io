<script setup>
    import { useData } from "vitepress"
    import { computed } from "vue"
    import CourseLessons from "./CourseLessons.vue"
    import LessonNav from "./LessonNav.vue"
    import TutorialsIndex from "./TutorialsIndex.vue"

    const { frontmatter } = useData()
    const isTutorialsIndex = computed(() => frontmatter.value.tutorials === "index")
    const isCourse = computed(() => frontmatter.value.course === true)
    const isLesson = computed(() => typeof frontmatter.value.lesson === "number")
</script>

<template>
    <div class="tutorials-footer">
        <TutorialsIndex v-if="isTutorialsIndex"/>
        <CourseLessons v-else-if="isCourse"/>
        <LessonNav v-else-if="isLesson"/>
    </div>
</template>
