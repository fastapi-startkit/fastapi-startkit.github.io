import { useData } from "vitepress"
import { computed } from "vue"
import { data as courses } from "./tutorials.data"

export function pad(n: number): string {
    return String(n).padStart(2, "0")
}

export function useTutorial() {
    const { page } = useData()

    const url = computed(() => "/" + page.value.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, ""))
    const course = computed(() => courses.find((c) => c.slug === page.value.relativePath.split("/")[1]))
    const index = computed(() => course.value?.lessons.findIndex((l) => l.url === url.value) ?? -1)
    const lesson = computed(() => (index.value >= 0 ? course.value!.lessons[index.value] : undefined))
    const prev = computed(() => (index.value > 0 ? course.value!.lessons[index.value - 1] : undefined))
    const next = computed(() => (index.value >= 0 ? course.value!.lessons[index.value + 1] : undefined))
    const progress = computed(() =>
        lesson.value && course.value ? Math.round(((index.value + 1) / course.value.lessons.length) * 100) : 0,
    )

    return { courses, course, lesson, index, prev, next, progress, url }
}
