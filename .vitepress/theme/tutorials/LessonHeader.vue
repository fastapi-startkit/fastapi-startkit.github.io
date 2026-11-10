<script setup lang="ts">
    import { Clock } from "lucide-vue-next"
    import { withBase } from "vitepress"
    import { pad, useTutorial } from "./useTutorial"

    const { course, lesson, progress } = useTutorial()
</script>

<template>
    <div v-if="course && lesson" class="tut-lesson-header">
        <nav class="tut-crumbs" aria-label="Breadcrumb">
            <a :href="withBase('/tutorials/')">Tutorials</a>
            <span aria-hidden="true">/</span>
            <a :href="withBase(course.url)">{{ course.title }}</a>
        </nav>
        <div class="tut-lesson-meta">
            <span class="tut-pill tut-pill--accent">Lesson {{ pad(lesson.number) }} of {{ pad(course.lessons.length) }}</span>
            <span v-if="lesson.duration" class="tut-pill"><Clock :size="13" aria-hidden="true"/>{{ lesson.duration }} min</span>
        </div>
        <div
            class="tut-progress"
            role="progressbar"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Course progress: ${progress}%`"
        >
            <span :style="{ width: `${progress}%` }"/>
        </div>
    </div>
</template>
