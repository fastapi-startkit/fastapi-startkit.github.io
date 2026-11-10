import { createContentLoader } from "vitepress"

export interface Lesson {
    url: string
    title: string
    description: string
    number: number
    duration: number
}

export interface Course {
    slug: string
    url: string
    title: string
    description: string
    level: string
    order: number
    duration: number
    lessons: Lesson[]
}

declare const data: Course[]
export { data }

export default createContentLoader("tutorials/*/*.md", {
    transform(pages) {
        const courses = new Map<string, Course>()
        const lessons = new Map<string, Lesson[]>()

        for (const page of pages) {
            const slug = page.url.split("/")[2]
            const fm = page.frontmatter

            if (fm.course) {
                courses.set(slug, {
                    slug,
                    url: page.url,
                    title: fm.title,
                    description: fm.description ?? "",
                    level: fm.level ?? "",
                    order: fm.order ?? 0,
                    duration: 0,
                    lessons: [],
                })
            } else if (typeof fm.lesson === "number") {
                const list = lessons.get(slug) ?? []
                list.push({
                    url: page.url,
                    title: fm.title,
                    description: fm.description ?? "",
                    number: fm.lesson,
                    duration: fm.duration ?? 0,
                })
                lessons.set(slug, list)
            }
        }

        for (const [slug, course] of courses) {
            course.lessons = (lessons.get(slug) ?? []).sort((a, b) => a.number - b.number)
            course.duration = course.lessons.reduce((total, lesson) => total + lesson.duration, 0)
        }

        return [...courses.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    },
})
