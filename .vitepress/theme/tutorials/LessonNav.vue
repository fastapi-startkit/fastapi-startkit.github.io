<script setup lang="ts">
    import { ArrowLeft, ArrowRight } from "lucide-vue-next"
    import { withBase } from "vitepress"
    import { pad, useTutorial } from "./useTutorial"

    const { course, lesson, prev, next } = useTutorial()
</script>

<template>
    <nav v-if="course && lesson" class="tut-pager" aria-label="Lesson navigation">
        <a v-if="prev" class="tut-pager__link" :href="withBase(prev.url)">
            <span class="tut-label"><ArrowLeft :size="13" aria-hidden="true"/>Previous lesson</span>
            <span class="tut-pager__title">{{ pad(prev.number) }}. {{ prev.title }}</span>
        </a>
        <a v-else class="tut-pager__link" :href="withBase(course.url)">
            <span class="tut-label"><ArrowLeft :size="13" aria-hidden="true"/>Course overview</span>
            <span class="tut-pager__title">{{ course.title }}</span>
        </a>
        <a v-if="next" class="tut-pager__link tut-pager__link--next" :href="withBase(next.url)">
            <span class="tut-label">Next lesson<ArrowRight :size="13" aria-hidden="true"/></span>
            <span class="tut-pager__title">{{ pad(next.number) }}. {{ next.title }}</span>
        </a>
        <a v-else class="tut-pager__link tut-pager__link--next" :href="withBase('/tutorials/')">
            <span class="tut-label">Course complete<ArrowRight :size="13" aria-hidden="true"/></span>
            <span class="tut-pager__title">Browse all tutorials</span>
        </a>
    </nav>
</template>
