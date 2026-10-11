<script setup lang="ts">
    const steps = [
        { title: "Install", command: "pip install \"fastapi-startkit[database]\"" },
        { title: "Make a model", command: "python artisan db:make:model Order" },
        { title: "Migrate", command: "python artisan db:migrate" },
    ]
</script>

<template>
    <section class="steps-section" aria-label="Get started in three steps">
        <ol class="hp-wrap steps">
            <li v-for="(step, index) in steps" :key="step.title" class="hp-card step">
                <span class="step__num" aria-hidden="true">{{ String(index + 1).padStart(2, "0") }}</span>
                <h3 class="step__title">{{ step.title }}</h3>
                <code class="step__cmd"><span aria-hidden="true">$ </span>{{ step.command }}</code>
            </li>
        </ol>
    </section>
</template>

<style scoped>
    .steps-section {
        padding: 0 0 112px;
    }

    .steps {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
        margin-top: 0;
        margin-bottom: 0;
        list-style: none;
    }

    .step {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
        padding: 22px;
    }

    .step__num {
        font: 900 44px/1 var(--hp-sans);
        letter-spacing: -0.06em;
        color: var(--hp-orange);
        -webkit-text-stroke: 1.5px var(--hp-line);
    }

    .step__title {
        margin: 6px 0 4px;
        font: 800 17px/1.2 var(--hp-sans);
        letter-spacing: -0.02em;
        color: var(--hp-ink);
    }

    .step__cmd {
        display: block;
        padding: 11px 12px;
        border-radius: 8px;
        background: var(--hp-term);
        color: var(--hp-term-ink);
        font: 500 12px/1.5 var(--hp-mono);
        overflow-wrap: anywhere;
    }

    .step__cmd span {
        color: var(--hp-orange);
    }

    @media (max-width: 900px) {
        .steps {
            grid-template-columns: minmax(0, 1fr);
        }

        .steps-section {
            padding-bottom: 80px;
        }
    }

    @media (max-width: 640px) {
        .steps-section {
            padding-bottom: 64px;
        }
    }
</style>
