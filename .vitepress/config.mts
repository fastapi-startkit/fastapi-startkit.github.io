import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Fastapi Startkit",
    description: "A repositories of components that can used inside fastapi or console applications",
    cleanUrls: true,

    transformHead: ({ pageData }) => {
        const title = pageData.frontmatter.title || pageData.title || 'Fastapi Startkit'
        const description = pageData.frontmatter.description || pageData.description || 'A repositories of components that can used inside fastapi or console applications'
        const url = `https://fastapi-startkit.github.io/${pageData.relativePath.replace(/\.md$/, '')}`

        const head = [
            ['meta', { property: 'og:title', content: title }],
            ['meta', { property: 'og:description', content: description }],
            ['meta', { property: 'og:url', content: url }],
            ['meta', { name: 'twitter:title', content: title }],
            ['meta', { name: 'twitter:description', content: description }],
        ]

        // Custom JSON-LD from frontmatter or dynamic generation
        let jsonLd = pageData.frontmatter.jsonLd

        if (!jsonLd) {
            const isBlog = pageData.relativePath.startsWith('docs') || pageData.frontmatter.layout === 'blog'

            if (isBlog) {
                jsonLd = {
                    "@context": "https://schema.org",
                    "@type": "BlogPosting",
                    "headline": title,
                    "description": description,
                    "url": url,
                    "author": {
                        "@type": "Person",
                        "name": pageData.frontmatter.author || "Fastapi Startkit Team",
                        "url": "https://github.com/fastapi-startkit"
                    },
                    "datePublished": pageData.frontmatter.date || new Date().toISOString(),
                    "publisher": {
                        "@type": "Organization",
                        "name": "Fastapi Startkit",
                        "logo": {
                            "@type": "ImageObject",
                            "url": "https://fastapi-startkit.github.io/logo.png"
                        }
                    },
                    "mainEntityOfPage": {
                        "@type": "WebPage",
                        "@id": url
                    }
                }
            } else {
                jsonLd = {
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    "name": title,
                    "description": description,
                    "url": url
                }
            }
        }

        head.push(['script', { type: 'application/ld+json' }, JSON.stringify(jsonLd)])

        return head as any
    },

    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Documentation', link: '/docs/getting-started' }
        ],

        sidebar: [
            {
                text: 'Guide',
                items: [
                    { text: 'Getting Started', link: '/docs/getting-started' },
                    { text: 'Configuration', link: '/docs/configuration' },
                    { text: 'FastAPI', link: '/docs/fastapi' },
                    { text: 'Exception Handling', link: '/docs/exception-handling' },
                    { text: 'Logging', link: '/docs/logging' },
                    { text: 'Console Commands', link: '/docs/console' }
                ]
            },
            {
                text: 'Frontend',
                items: [
                    { text: 'Introduction', link: '/docs/frontend/' },
                    { text: 'Vite', link: '/docs/frontend/vite' },
                    { text: 'Inertia', link: '/docs/frontend/inertia' },
                ]
            },
            {
                text: 'Database',
                items: [
                    { text: 'Introduction', link: '/docs/database/' },
                    { text: 'Models', link: '/docs/database/models' },
                    { text: 'Migrations', link: '/docs/database/migrations' },
                    { text: 'Seeds', link: '/docs/database/seeds' },
                    { text: 'Relationships', link: '/docs/database/relationships' },
                ]
            },
            {
                text: 'Testing',
                items: [
                    { text: 'FastAPI Testing', link: '/docs/testing/fastapi' },
                    { text: 'Database Testing', link: '/docs/testing/database' },
                ]
            }
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/fastapi-startkit/fastapi_startkit' }
        ]
    }
})
