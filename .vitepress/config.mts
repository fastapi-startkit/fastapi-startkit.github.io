import { defineConfig } from 'vitepress'
// @ts-ignore
import tailwindcss from '@tailwindcss/vite'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Fastapi Startkit",
    description: "FastAPI Startkit is a batteries-included starter kit and boilerplate for building Python applications with FastAPI. Includes SQLAlchemy async ORM, Alembic migrations, reusable components, service providers, CLI console commands, Vite frontend integration, and Inertia.js support.",
    cleanUrls: true,
    lastUpdated: true,
    sitemap: {
        hostname: 'https://fastapi-startkit.github.io/sitemap.xml'
    },
    head: [
        ['meta', { name: 'google-site-verification', content: 'RpM5amadnjbR3TF0J4L4MXB4TWYVesPz0ssaXg7-jYM' }]
    ],

    vite: {
        plugins: [
            tailwindcss(),
        ],
    },

    transformHead: ({ pageData }) => {
        const defaultDescription = 'FastAPI Startkit is a batteries-included starter kit and boilerplate for building Python applications with FastAPI. Includes async ORM powered by SQLAlchemy, migrations, reusable components, service providers, CLI console commands, Vite frontend integration, and Inertia.js support.'
        const defaultKeywords = 'FastAPI, FastAPI starter kit, FastAPI boilerplate, Python starter kit, Python boilerplate, SQLAlchemy, SQLAlchemy async, Fastapi migrations, FastAPI components, service providers, FastAPI framework, Python framework, FastAPI template, FastAPI scaffold, FastAPI ORM, FastAPI CLI, FastAPI Inertia, FastAPI Vite, FastAPI SQLAlchemy, async Python, Python web framework'

        const title = pageData.frontmatter.title || pageData.title || 'Fastapi Startkit'
        const description = pageData.frontmatter.description || pageData.description || defaultDescription
        const url = `https://fastapi-startkit.github.io/${pageData.relativePath.replace(/\.md$/, '')}`
        const keywords = pageData.frontmatter.keywords || defaultKeywords
        const datePublished = pageData.frontmatter.date || new Date().toISOString()
        const dateModified = pageData.lastUpdated ? new Date(pageData.lastUpdated).toISOString() : datePublished

        const head: any[] = [
            ['link', { rel: 'canonical', href: url }],
            ['meta', { property: 'og:title', content: title }],
            ['meta', { property: 'og:description', content: description }],
            ['meta', { property: 'og:url', content: url }],
            ['meta', { property: 'og:type', content: 'website' }],
            ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
            ['meta', { name: 'twitter:title', content: title }],
            ['meta', { name: 'twitter:description', content: description }],
        ]

        if (keywords) {
            head.push(['meta', { name: 'keywords', content: keywords }])
        }

        // Generate Breadcrumbs
        const pathParts = pageData.relativePath.split('/').filter(p => p && p !== 'index.md')
        const breadcrumbs = [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://fastapi-startkit.github.io/"
            },
            ...pathParts.map((part, index) => {
                const path = pathParts.slice(0, index + 1).join('/')
                const name = part.replace(/-/g, ' ').replace(/\.md$/, '')
                return {
                    "@type": "ListItem",
                    "position": index + 2,
                    "name": name.charAt(0).toUpperCase() + name.slice(1),
                    "item": `https://fastapi-startkit.github.io/${path.replace(/\.md$/, '')}`
                }
            })
        ]

        // Custom JSON-LD from frontmatter or dynamic generation
        let jsonLd: any = pageData.frontmatter.jsonLd

        if (!jsonLd) {
            const isBlog = pageData.relativePath.startsWith('blog/') || pageData.frontmatter.layout === 'blog'
            const isDoc = pageData.relativePath.startsWith('docs/')

            const graph: any[] = [
                {
                    "@type": "WebPage",
                    "@id": `${url}#webpage`,
                    "url": url,
                    "name": title,
                    "isPartOf": { "@id": "https://fastapi-startkit.github.io/#website" },
                    "description": description,
                    "breadcrumb": { "@id": `${url}#breadcrumb` },
                    "inLanguage": "en-US",
                    "potentialAction": [{ "@type": "ReadAction", "target": [url] }]
                },
                {
                    "@type": "WebSite",
                    "@id": "https://fastapi-startkit.github.io/#website",
                    "url": "https://fastapi-startkit.github.io/",
                    "name": "Fastapi Startkit",
                    "description": defaultDescription,
                    "inLanguage": "en-US",
                    "publisher": {
                        "@type": "Organization",
                        "name": "Fastapi Startkit",
                        "logo": {
                            "@type": "ImageObject",
                            "url": "https://fastapi-startkit.github.io/logo.png"
                        }
                    }
                },
                {
                    "@type": "BreadcrumbList",
                    "@id": `${url}#breadcrumb`,
                    "itemListElement": breadcrumbs
                }
            ]

            if (isBlog || isDoc) {
                const type = isBlog ? "BlogPosting" : "TechArticle"
                graph.push({
                    "@type": type,
                    "@id": `${url}#mainEntity`,
                    "headline": title,
                    "description": description,
                    "datePublished": datePublished,
                    "dateModified": dateModified,
                    "author": { "@id": "https://fastapi-startkit.github.io/#author" },
                    "publisher": { "@id": "https://fastapi-startkit.github.io/#website" },
                    "keywords": keywords,
                    "mainEntityOfPage": { "@id": `${url}#webpage` }
                })
                graph.push({
                    "@type": "Person",
                    "@id": "https://fastapi-startkit.github.io/#author",
                    "name": pageData.frontmatter.author || "Fastapi Startkit Team",
                    "url": "https://github.com/fastapi-startkit"
                })
            }

            jsonLd = {
                "@context": "https://schema.org",
                "@graph": graph
            }
        } else {
            jsonLd = {
                "@context": "https://schema.org",
                "@graph": jsonLd["@graph"] || [jsonLd]
            }
        }

        head.push(['script', { type: 'application/ld+json' }, JSON.stringify(jsonLd)])

        return head as any
    },

    themeConfig: {
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
                    { text: 'Casts', link: '/docs/database/casts' },
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
            },
            {
                text: 'Digging Deeper',
                items: [
                    { text: 'Storage', link: '/docs/storage' },
                ]
            }
        ],

        search: {
            provider: 'local'
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/fastapi-startkit/fastapi_startkit' }
        ]
    }
})
