import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "Fastapi Startkit",
    description: "A repositories of components that can used inside fastapi or console applications",
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
