<script setup lang="ts">
    import { ArrowRight } from "lucide-vue-next"
    import { withBase } from "vitepress"
    import { pad, useTutorial } from "./useTutorial"

    const { course } = useTutorial()
</script>

<template>
    <section v-if="course && course.lessons.length" class="tut-course">
        <div class="tut-course__head">
            <h2 id="lessons" class="tut-course__title">Lessons</h2>
            <a class="tut-button" :href="withBase(course.lessons[0].url)">
                Start the course<ArrowRight :size="15" aria-hidden="true"/>
            </a>
        </div>
        <ol class="tut-course__list">
            <li v-for="item in course.lessons" :key="item.url">
                <a class="tut-course__lesson" :href="withBase(item.url)">
                    <span class="tut-course__num">{{ pad(item.number) }}</span>
                    <span class="tut-course__body">
                        <span class="tut-course__name">{{ item.title }}</span>
                        <span v-if="item.description" class="tut-course__desc">{{ item.description }}</span>
                    </span>
                    <span v-if="item.duration" class="tut-course__time">{{ item.duration }} min</span>
                </a>
            </li>
        </ol>
    </section>
</template>
