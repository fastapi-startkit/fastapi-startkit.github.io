<script setup lang="ts">
    const commands = ["python artisan db:make:model Order", "python artisan db:migrate", "python artisan db:seed"]

    const cards = [
        { label: "03 / core", title: "Async core", text: "FastAPI, Starlette and Pydantic underneath. OpenAPI docs and type-hinted requests, end to end.", code: "user = await User.find_or_fail(1)", href: "/docs/fastapi" },
        { label: "04 / data", title: "ORM & migrations", text: "Active-record models, a chainable query builder, migrations, seeders and factories.", code: "await Order.where(\"status\", \"paid\").get()", href: "/docs/database/" },
        { label: "05 / logs", title: "Logging channels", text: "Terminal, daily files, syslog and Slack — configured, not coded.", code: "Logger.info(\"Order paid\")", href: "/docs/logging" },
        { label: "06 / evals", title: "Agent evals", text: "Fake or record agents, assert on tool calls and trajectories, and grade answers with an LLM judge.", code: "agent.assert_tool_called(\"lookup_order\")", href: "/docs/ai/agent#testing", wide: true },
    ]
</script>

<template>
    <section class="hp-section bento-section" aria-labelledby="bento-title">
        <div class="hp-wrap">
            <div class="hp-head">
                <h2 id="bento-title" class="hp-h2">Every layer, <em class="ink">wired together.</em></h2>
                <p class="hp-blurb">
                    Each module is a service provider you register. Use the whole stack, or just the core —
                    nothing loads that you didn’t ask for.
                </p>
            </div>

            <div class="bento">
                <a href="/docs/console" class="tile tile--dark">
                    <span class="hp-label">01 / cli</span>
                    <h3 class="tile__title">Artisan, <em class="hp-serif">in Python.</em></h3>
                    <p class="tile__text">Scaffold models, run migrations, seed data and write your own commands — powered by Cleo.</p>
                    <div class="tile__term">
                        <code v-for="cmd in commands" :key="cmd"><span aria-hidden="true">$ </span>{{ cmd }}</code>
                    </div>
                </a>

                <a href="/docs/ai/mcp" class="tile tile--orange">
                    <span class="hp-label">02 / ai</span>
                    <h3 class="tile__title">MCP servers &amp; LLMs</h3>
                    <p class="tile__text">
                        Expose tools, prompts and resources over MCP, and build agents on OpenAI, Google and other
                        models through LangChain.
                    </p>
                    <code class="tile__pill">@provider("openai")</code>
                </a>

                <a v-for="card in cards" :key="card.title" :href="card.href" class="tile tile--light" :class="{ 'tile--wide': card.wide }">
                    <span class="hp-label">{{ card.label }}</span>
                    <h3 class="tile__title tile__title--sm">{{ card.title }}</h3>
                    <p class="tile__text">{{ card.text }}</p>
                    <code class="tile__snippet">{{ card.code }}</code>
                </a>
            </div>
        </div>
    </section>
</template>

<style scoped>
    .bento-section {
        padding-top: 32px;
    }

    .hp-h2 em.ink {
        color: var(--hp-ink);
    }

    .bento {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
    }

    .tile {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
        padding: 24px;
        border: 1.5px solid var(--hp-line);
        border-radius: 16px;
        box-shadow: 4px 4px 0 var(--hp-shadow);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .tile:hover {
        transform: translate(-2px, -2px);
        box-shadow: 6px 6px 0 var(--hp-shadow);
    }

    .tile--dark {
        grid-column: span 2;
        min-height: 300px;
        background: var(--hp-term);
        color: var(--hp-term-ink);
        border-color: var(--hp-term-line);
    }

    .tile--dark .hp-label {
        color: var(--hp-term-muted);
    }

    .tile--orange {
        background: var(--hp-orange);
        color: #111110;
        border-color: #111110;
    }

    .tile--orange .hp-label {
        color: #3a1a0c;
    }

    .tile--light {
        background: var(--hp-card);
    }

    .tile--wide {
        grid-column: 1 / -1;
    }

    .tile__title {
        margin: 6px 0 0;
        font: 800 clamp(24px, 3vw, 32px)/1.05 var(--hp-sans);
        letter-spacing: -0.045em;
    }

    .tile__title--sm {
        font-size: 20px;
        letter-spacing: -0.03em;
    }

    .tile__text {
        max-width: 420px;
        margin: 0;
        font-size: 13.5px;
        line-height: 1.55;
        opacity: 0.85;
    }

    .tile--light .tile__text {
        color: var(--hp-ink-soft);
        opacity: 1;
    }

    .tile__term {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: auto;
        padding: 16px 18px;
        border-radius: 10px;
        background: var(--hp-term-2);
        overflow-x: auto;
    }

    .tile__term code {
        font: 500 12.5px/1.4 var(--hp-mono);
        color: var(--hp-term-ink);
        background: none;
        padding: 0;
        white-space: nowrap;
    }

    .tile__term span {
        color: var(--hp-orange);
    }

    .tile__pill {
        align-self: flex-start;
        margin-top: auto;
        padding: 8px 12px;
        border-radius: 8px;
        background: #111110;
        color: #fbfaf7;
        font: 500 12px/1 var(--hp-mono);
    }

    .tile__snippet {
        margin-top: auto;
        padding-top: 14px;
        border-top: 1.5px dashed var(--hp-line-soft);
        font: 500 12px/1.4 var(--hp-mono);
        color: var(--hp-ink);
        background: none;
        overflow-wrap: anywhere;
    }

    @media (max-width: 900px) {
        .bento {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .tile--dark,
        .tile--orange {
            grid-column: 1 / -1;
        }
    }

    @media (max-width: 640px) {
        .bento {
            grid-template-columns: minmax(0, 1fr);
        }

        .tile {
            padding: 20px;
        }

        .tile--dark {
            min-height: 0;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .tile,
        .tile:hover {
            transition: none;
            transform: none;
        }
    }
</style>
