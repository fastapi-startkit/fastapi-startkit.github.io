<script setup lang="ts">
    import { ArrowRight, BookOpen, Clock, Signal } from "lucide-vue-next"
    import { withBase } from "vitepress"
    import { useTutorial } from "./useTutorial"

    const { courses } = useTutorial()
</script>

<template>
    <section class="tut-index" aria-label="Courses">
        <a v-for="course in courses" :key="course.slug" class="tut-card" :href="withBase(course.url)">
            <span class="tut-label">Course</span>
            <span class="tut-card__title">{{ course.title }}</span>
            <span class="tut-card__desc">{{ course.description }}</span>
            <span class="tut-lesson-meta">
                <span class="tut-pill"><BookOpen :size="13" aria-hidden="true"/>{{ course.lessons.length }} lessons</span>
                <span v-if="course.duration" class="tut-pill"><Clock :size="13" aria-hidden="true"/>{{ course.duration }} min</span>
                <span v-if="course.level" class="tut-pill"><Signal :size="13" aria-hidden="true"/>{{ course.level }}</span>
            </span>
            <span class="tut-card__cta">View course<ArrowRight :size="14" aria-hidden="true"/></span>
        </a>
    </section>
</template>
