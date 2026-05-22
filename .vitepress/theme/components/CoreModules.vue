<script setup>
import { Globe, Terminal, Activity, CircleCheck } from 'lucide-vue-next'
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
                <div class="bg-white p-10 flex flex-col gap-8 border-r border-outline-variant hover:bg-brand-teal/[0.02] transition-colors group">
                    <div class="space-y-4">
                        <div class="w-10 h-10 bg-brand-teal/10 rounded flex items-center justify-center text-brand-teal group-hover:scale-110 transition-transform">
                            <Globe :size="20" />
                        </div>
                        <h3 class="font-headline-md text-headline-md font-semibold text-on-surface tracking-[-0.01em]">Asynchronous Core</h3>
                        <p class="text-body-sm font-body-sm text-on-surface-variant">Fully async stack built on FastAPI, Starlette, Pydantic, and Masonite ORM — providing the fastest possible execution path for Python web applications.</p>
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
                <div class="bg-white p-10 flex flex-col gap-8 border-r border-outline-variant hover:bg-brand-teal/[0.02] transition-colors group">
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

                <!-- Module 3: Observability Stack -->
                <div class="bg-white p-10 flex flex-col gap-8 hover:bg-brand-teal/[0.02] transition-colors group">
                    <div class="space-y-4">
                        <div class="w-10 h-10 bg-brand-teal/10 rounded flex items-center justify-center text-brand-teal group-hover:scale-110 transition-transform">
                            <Activity :size="20" />
                        </div>
                        <h3 class="font-headline-md text-headline-md font-semibold text-on-surface tracking-[-0.01em]">Observability Stack</h3>
                        <p class="text-body-sm font-body-sm text-on-surface-variant">Native integration with Prometheus, Grafana, and OpenTelemetry for deep inspection of application state.</p>
                    </div>
                    <div class="mt-auto space-y-4">
                        <div class="h-24 w-full bg-surface-container-low rounded border border-outline-variant flex items-end p-2 gap-1 overflow-hidden group-hover:border-brand-teal/30 transition-colors">
                            <div class="bg-brand-teal/20 h-[60%] w-full rounded-t-sm"></div>
                            <div class="bg-brand-teal/40 h-[80%] w-full rounded-t-sm"></div>
                            <div class="bg-brand-teal h-[95%] w-full rounded-t-sm animate-pulse"></div>
                            <div class="bg-brand-teal/30 h-[40%] w-full rounded-t-sm"></div>
                            <div class="bg-brand-teal/20 h-[70%] w-full rounded-t-sm"></div>
                            <div class="bg-brand-teal/50 h-[85%] w-full rounded-t-sm"></div>
                        </div>
                        <div class="flex justify-between text-[10px] text-outline font-label-sm uppercase">
                            <span>Request Throughput</span>
                            <span class="text-brand-teal font-bold">STABLE</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
