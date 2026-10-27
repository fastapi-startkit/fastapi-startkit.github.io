<script setup lang="ts">
    import { Check } from "lucide-vue-next"
    import { withBase } from "vitepress"
    import { pad, useTutorial } from "./useTutorial"

    const { course, index, progress } = useTutorial()
</script>

<template>
    <div v-if="course && index >= 0" class="tut-aside">
        <div class="tut-aside__head">
            <span class="tut-label">Your progress</span>
            <span class="tut-aside__percent">{{ progress }}%</span>
        </div>
        <div class="tut-progress" aria-hidden="true">
            <span :style="{ width: `${progress}%` }"/>
        </div>
        <span class="tut-label tut-aside__title">All lessons</span>
        <ol class="tut-aside__list">
            <li v-for="(item, i) in course.lessons" :key="item.url">
                <a
                    :href="withBase(item.url)"
                    :class="{ 'is-done': i < index, 'is-current': i === index }"
                    :aria-current="i === index ? 'page' : undefined"
                >
                    <span class="tut-aside__num">
                        <Check v-if="i < index" :size="12" aria-hidden="true"/>
                        <template v-else>{{ pad(item.number) }}</template>
                    </span>
                    <span>{{ item.title }}</span>
                </a>
            </li>
        </ol>
    </div>
</template>
