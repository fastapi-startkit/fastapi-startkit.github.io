import {defineConfig} from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: "FastAPI Starter Kit",
    description: "A repositories of components that can used inside fastapi or console applications",
    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            {text: 'Home', link: '/'},
            {text: 'Documentation', link: '/docs/getting-started'}
        ],

        sidebar: [
            {
                text: 'Guide',
                items: [
                    {text: 'Getting Started', link: '/docs/getting-started'},
                    {text: 'FastAPI', link: '/docs/fastapi'},
                    {text: 'Logging', link: '/docs/logging'},
                    {text: 'Console Commands', link: '/docs/console'}
                ]
            }
        ],

        socialLinks: [
            {icon: 'github', link: 'https://github.com/fastapi-startkit/fastapi_startkit'}
        ]
    }
})
