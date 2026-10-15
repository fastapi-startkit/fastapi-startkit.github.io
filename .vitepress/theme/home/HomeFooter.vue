<script setup lang="ts">
    const year = new Date().getFullYear()

    const links = [
        { text: "Docs", href: "/docs/getting-started" },
        { text: "GitHub", href: "https://github.com/fastapi-startkit/fastapi-startkit" },
        { text: "PyPI", href: "https://pypi.org/project/fastapi-startkit/" },
    ]
</script>

<template>
    <footer class="foot">
        <div class="hp-wrap">
            <div class="foot__top">
                <p class="foot__meta">
                    <span>A Laravel-style application framework for Python.</span>
                    <span>© {{ year }} FastAPI Startkit</span>
                </p>
                <nav aria-label="Footer">
                    <ul class="foot__links">
                        <li v-for="link in links" :key="link.text">
                            <a :href="link.href" :target="link.href.startsWith('http') ? '_blank' : undefined" :rel="link.href.startsWith('http') ? 'noopener' : undefined">{{ link.text }}</a>
                        </li>
                    </ul>
                </nav>
            </div>
            <p class="foot__word" aria-hidden="true">
                <span class="foot__fast">fastapi</span>
                <span class="foot__kit">startkit<span>.</span></span>
            </p>
        </div>
    </footer>
</template>

<style scoped>
    .foot {
        padding: 40px 0 24px;
        background: var(--hp-term);
        color: #f3efe7;
        overflow: hidden;
    }

    .foot__top {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 16px 32px;
        padding-bottom: 24px;
        border-bottom: 1px solid #2b2926;
    }

    .foot__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 28px;
        margin: 0;
        font: 400 12px/1.5 var(--hp-mono);
        color: #a49d91;
    }

    .foot__links {
        display: flex;
        gap: 24px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .foot__links a {
        font: 600 13px/1.5 var(--hp-sans);
        color: #f3efe7;
    }

    .foot__links a:hover {
        color: var(--hp-orange);
    }

    .foot__word {
        display: flex;
        flex-direction: column;
        margin: 32px 0 0;
        line-height: 0.82;
    }

    .foot__fast {
        font: italic 400 clamp(5rem, 19vw, 15rem)/0.9 var(--hp-serif);
        color: var(--hp-orange);
        letter-spacing: -0.03em;
    }

    .foot__kit {
        margin-left: 0.6em;
        font: 900 clamp(4.4rem, 17vw, 13.5rem)/0.85 var(--hp-sans);
        letter-spacing: -0.07em;
        color: #fbfaf7;
    }

    .foot__kit span {
        color: var(--hp-orange);
    }

    @media (max-width: 640px) {
        .foot__kit {
            margin-left: 0.3em;
        }
    }
</style>
