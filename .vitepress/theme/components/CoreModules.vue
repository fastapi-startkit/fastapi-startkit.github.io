<script setup>
import { Globe, Terminal, Bot, CircleCheck } from 'lucide-vue-next'
</script>

<template>
    <section class="py-32 bg-surface">
        <div class="max-w-7xl mx-auto px-10">
            <div class="mb-20">
                <h2 class="font-headline-lg text-headline-lg font-semibold text-on-surface mb-4 tracking-[-0.02em]">Core Infrastructure Modules</h2>
                <p class="text-on-surface-variant font-body-md text-body-md max-w-2xl">Modular architectural blocks designed for seamless integration into complex high-load environments.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-0 border border-outline-variant rounded overflow-hidden shadow-sm">
                <!-- Module 1: Asynchronous Core -->
                <div class="bg-surface-container-lowest p-10 flex flex-col gap-8 border-r border-outline-variant hover:bg-brand-teal/[0.02] transition-colors group">
                    <div class="space-y-4">
                        <div class="w-10 h-10 bg-brand-teal/10 rounded flex items-center justify-center text-brand-teal group-hover:scale-110 transition-transform">
                            <Globe :size="20" />
                        </div>
                        <h3 class="font-headline-md text-headline-md font-semibold text-on-surface tracking-[-0.01em]">Asynchronous Core</h3>
                        <p class="text-body-sm font-body-sm text-on-surface-variant">Fully async stack built on FastAPI, Starlette, Pydantic, and Masonite ORM — a fully async execution path for Python web applications.</p>
                    </div>
                    <div class="mt-auto space-y-3">
                        <div class="flex items-center gap-3 py-2 border-t border-outline-variant/50">
                            <CircleCheck :size="16" class="text-brand-teal" />
                            <span class="text-label-sm font-label-sm text-on-surface">Automatic OpenAPI Docs</span>
                        </div>
                        <div class="flex items-center gap-3 py-2 border-t border-outline-variant/50">
                            <CircleCheck :size="16" class="text-brand-teal" />
                            <span class="text-label-sm font-label-sm text-on-surface">Strict Typing Engine</span>
                        </div>
                    </div>
                </div>

                <!-- Module 2: DevOps CLI -->
                <div class="bg-surface-container-lowest p-10 flex flex-col gap-8 border-r border-outline-variant hover:bg-brand-teal/[0.02] transition-colors group">
                    <div class="space-y-4">
                        <div class="w-10 h-10 bg-brand-teal/10 rounded flex items-center justify-center text-brand-teal group-hover:scale-110 transition-transform">
                            <Terminal :size="20" />
                        </div>
                        <h3 class="font-headline-md text-headline-md font-semibold text-on-surface tracking-[-0.01em]">Artisan CLI</h3>
                        <p class="text-body-sm font-body-sm text-on-surface-variant">Powerful artisan commands for scaffolding models, running migrations, seeding databases, and managing your application — all from the terminal.</p>
                    </div>
                    <div class="bg-editor-bg p-4 rounded font-label-sm text-[11px] text-[#27c93f] shadow-inner border border-brand-teal/20">
                        <div class="flex gap-2">
                            <span class="text-brand-teal">$</span>
                            python artisan db:migrate
                        </div>
                        <div class="text-[#8b949e] mt-1">&gt; Running migrations...</div>
                        <div class="text-brand-teal mt-1">&gt; 3 migrations applied successfully.</div>
                    </div>
                </div>

                <!-- Module 3: AI & Agents -->
                <div class="bg-surface-container-lowest p-10 flex flex-col gap-8 hover:bg-brand-teal/[0.02] transition-colors group">
                    <div class="space-y-4">
                        <div class="w-10 h-10 bg-brand-teal/10 rounded flex items-center justify-center text-brand-teal group-hover:scale-110 transition-transform">
                            <Bot :size="20" />
                        </div>
                        <h3 class="font-headline-md text-headline-md font-semibold text-on-surface tracking-[-0.01em]">AI &amp; Agents</h3>
                        <p class="text-body-sm font-body-sm text-on-surface-variant">Build AI-native services and autonomous agents on the async core — register LLM providers, orchestrate tools, and stream responses through the same container and provider pattern that powers the rest of your app.</p>
                    </div>
                    <div class="mt-auto">
                        <div class="bg-surface-container-low rounded border border-outline-variant p-3 space-y-3 group-hover:border-brand-teal/30 transition-colors">
                            <div class="flex justify-end">
                                <span class="text-[11px] font-label-sm text-on-surface bg-brand-teal/10 rounded-lg rounded-br-none px-3 py-1.5 max-w-[80%]">Summarize today's orders</span>
                            </div>
                            <div class="flex items-start gap-2">
                                <div class="w-6 h-6 shrink-0 bg-brand-teal/10 rounded flex items-center justify-center text-brand-teal">
                                    <Bot :size="14" />
                                </div>
                                <span class="text-[11px] font-label-sm text-on-surface-variant bg-surface-container rounded-lg rounded-bl-none px-3 py-1.5 max-w-[80%]">
                                    42 orders · $3,180 total
                                    <span class="inline-flex ml-1 h-2 w-2 rounded-full bg-brand-teal animate-pulse align-middle"></span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
