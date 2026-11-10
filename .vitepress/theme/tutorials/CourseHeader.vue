<script setup lang="ts">
    import { BookOpen, Clock, Signal } from "lucide-vue-next"
    import { withBase } from "vitepress"
    import { useTutorial } from "./useTutorial"

    const { course } = useTutorial()
</script>

<template>
    <div v-if="course" class="tut-lesson-header">
        <nav class="tut-crumbs" aria-label="Breadcrumb">
            <a :href="withBase('/tutorials/')">Tutorials</a>
            <span aria-hidden="true">/</span>
            <span>Course</span>
        </nav>
        <div class="tut-lesson-meta">
            <span class="tut-pill tut-pill--accent"><BookOpen :size="13" aria-hidden="true"/>{{ course.lessons.length }} lessons</span>
            <span v-if="course.duration" class="tut-pill"><Clock :size="13" aria-hidden="true"/>{{ course.duration }} min</span>
            <span v-if="course.level" class="tut-pill"><Signal :size="13" aria-hidden="true"/>{{ course.level }}</span>
        </div>
    </div>
</template>
