<script setup lang="ts">
    const names = ["FastAPI", "Starlette", "Pydantic", "Masonite ORM", "SQLAlchemy", "Cleo", "LangChain", "Pendulum"]
</script>

<template>
    <section class="marquee" aria-label="Built on">
        <div class="marquee__track">
            <ul class="marquee__list">
                <li v-for="name in names" :key="name">{{ name }}</li>
            </ul>
            <ul class="marquee__list marquee__list--clone" aria-hidden="true">
                <li v-for="name in names" :key="name">{{ name }}</li>
            </ul>
        </div>
    </section>
</template>

<style scoped>
    .marquee {
        overflow: hidden;
        background: var(--hp-term);
        color: #f3efe7;
        border-bottom: 1.5px solid var(--hp-line);
    }

    .marquee__track {
        display: flex;
        width: max-content;
        animation: marquee 32s linear infinite;
    }

    .marquee:hover .marquee__track {
        animation-play-state: paused;
    }

    .marquee__list {
        display: flex;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .marquee__list li {
        display: flex;
        align-items: center;
        padding: 18px 0;
        font: 800 clamp(18px, 2.2vw, 24px)/1 var(--hp-sans);
        letter-spacing: -0.03em;
        white-space: nowrap;
    }

    .marquee__list li::after {
        content: "";
        width: 8px;
        height: 8px;
        margin: 0 36px;
        border-radius: 50%;
        background: var(--hp-orange);
    }

    @keyframes marquee {
        to {
            transform: translateX(-50%);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .marquee__track {
            width: auto;
            animation: none;
            justify-content: center;
        }

        .marquee__list {
            flex-wrap: wrap;
            justify-content: center;
            padding: 0 16px;
        }

        .marquee__list li {
            padding: 10px 0;
        }

        .marquee__list li::after {
            margin: 0 18px;
        }

        .marquee__list--clone {
            display: none;
        }
    }
</style>
