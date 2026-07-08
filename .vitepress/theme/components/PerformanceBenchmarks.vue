<script setup>
import { Gauge, Shield, ArrowRight } from 'lucide-vue-next'
</script>

<template>
    <section class="relative bg-[#0f172a] text-white py-32 overflow-hidden">
        <!-- Background effects -->
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_60%_50%,rgba(5,150,105,0.15)_0%,transparent_50%)]"></div>
        <div class="absolute inset-0 opacity-10" style="background-image: url('data:image/svg+xml,%3Csvg width=&quot;40&quot; height=&quot;40&quot; viewBox=&quot;0 0 40 40&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cpath d=&quot;M0 0h1v1H0V0zm1 1h1v1H1V1z&quot; fill=&quot;%23059669&quot; fill-opacity=&quot;0.4&quot; fill-rule=&quot;evenodd&quot;/%3E%3C/svg%3E');"></div>

        <div class="max-w-7xl mx-auto px-10 relative z-10">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <!-- Left: Content -->
                <div class="space-y-12">
                    <div class="space-y-6">
                        <div class="inline-flex items-center gap-2 px-3 py-1 bg-brand-teal/10 border border-brand-teal/30 rounded-full">
                            <span class="text-brand-teal font-label-sm uppercase tracking-[0.2em] text-[10px] font-bold">System Architecture</span>
                        </div>
                        <h2 class="font-headline-xl text-headline-xl font-bold tracking-[-0.04em]">
                            Built for scale.
                            <br/>
                            <span class="text-brand-teal text-glow">Same request path.</span>
                        </h2>
                        <p class="text-white/70 font-body-lg text-body-lg max-w-xl">
                            The Startkit is a thin, provider-driven layer over FastAPI. Every request still runs on the same Starlette and uvicorn hot path as hand-written FastAPI — the framework adds its wiring at boot, not on the request path.
                        </p>
                    </div>

                    <ul class="space-y-8">
                        <li class="flex items-start gap-6 group/item">
                            <div class="mt-1 w-10 h-10 rounded bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center shrink-0 group-hover/item:bg-brand-teal/30 transition-colors">
                                <Gauge :size="20" class="text-brand-teal" />
                            </div>
                            <div class="space-y-1">
                                <h4 class="font-headline-md text-headline-md font-semibold text-white tracking-[-0.01em]">Measured, not marketed</h4>
                                <p class="text-white/90 text-body-sm font-body-sm max-w-md">Every number here comes from the public <a href="https://github.com/fastapi-startkit/web-frameworks" class="text-brand-teal hover:underline">web-frameworks</a> harness — a reproducible benchmark you can run yourself against a raw FastAPI baseline.</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-6 group/item">
                            <div class="mt-1 w-10 h-10 rounded bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center shrink-0 group-hover/item:bg-brand-teal/30 transition-colors">
                                <Shield :size="20" class="text-brand-teal" />
                            </div>
                            <div class="space-y-1">
                                <h4 class="font-headline-md text-headline-md font-semibold text-white tracking-[-0.01em]">Honest baseline</h4>
                                <p class="text-white/90 text-body-sm font-body-sm max-w-md">The baseline is raw FastAPI itself — an overhead delta, not an apples-to-oranges comparison against an unrelated stack.</p>
                            </div>
                        </li>
                    </ul>
                </div>

                <!-- Right: Benchmark Card -->
                <div class="relative">
                    <div class="absolute -inset-10 bg-brand-teal/20 blur-[100px] rounded-full opacity-40"></div>
                    <div class="relative bg-slate-900/60 border border-brand-teal/20 p-10 rounded-xl backdrop-blur-xl shadow-[0_0_50px_rgba(5,150,105,0.1)]">
                        <div class="flex justify-between items-center mb-4">
                            <div class="flex items-center gap-3">
                                <div class="w-2 h-2 rounded-full bg-brand-teal animate-pulse"></div>
                                <div class="font-label-md text-label-md text-white/90 uppercase tracking-widest">Performance Benchmark</div>
                            </div>
                            <div class="text-brand-teal text-[10px] font-bold border border-brand-teal/40 px-2 py-0.5 rounded uppercase tracking-tighter">Overhead delta</div>
                        </div>

                        <p class="text-white/50 text-[11px] mb-12 tracking-wide">Relative to raw FastAPI · uvicorn · oha · concurrency 64</p>

                        <div class="space-y-8">
                            <!-- GET / -->
                            <div class="space-y-3">
                                <div class="flex justify-between text-[11px] font-label-sm uppercase tracking-wider">
                                    <span class="text-white font-bold">GET /</span>
                                    <span class="text-white/80 font-bold">−2.9%</span>
                                </div>
                                <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <div class="h-full bg-gradient-to-r from-brand-teal/50 to-brand-teal w-[97%] shadow-[0_0_15px_rgba(5,153,139,0.5)] transition-all duration-1000"></div>
                                </div>
                            </div>

                            <!-- GET /user/{id} -->
                            <div class="space-y-3">
                                <div class="flex justify-between text-[11px] font-label-sm uppercase tracking-wider">
                                    <span class="text-white font-bold">GET /user/&#123;id&#125;</span>
                                    <span class="text-white/80 font-bold">−1.5%</span>
                                </div>
                                <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <div class="h-full bg-gradient-to-r from-brand-teal/50 to-brand-teal w-[98%] shadow-[0_0_15px_rgba(5,153,139,0.5)] transition-all duration-1000"></div>
                                </div>
                            </div>

                            <!-- POST /user -->
                            <div class="space-y-3">
                                <div class="flex justify-between text-[11px] font-label-sm uppercase tracking-wider">
                                    <span class="text-white font-bold">POST /user</span>
                                    <span class="text-white/80 font-bold">−17.3%</span>
                                </div>
                                <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <div class="h-full bg-gradient-to-r from-brand-teal/40 to-brand-teal/80 w-[83%] transition-all duration-1000"></div>
                                </div>
                            </div>
                        </div>

                        <p class="mt-10 text-white/70 text-body-sm font-body-sm leading-relaxed">
                            The GET routes run <span class="text-brand-teal font-semibold">within a few percent</span> of raw FastAPI. The wider <span class="text-white font-semibold">POST /user</span> gap is FastAPI 0.139's <code class="text-brand-teal">include_router</code> resolution — reproducible in plain FastAPI, not framework per-request code.
                        </p>

                        <p class="mt-4 text-white/40 text-[10px] leading-relaxed">
                            Source: web-frameworks · relative, same-host comparison — not official benchmark figures.
                        </p>

                        <div class="mt-10 pt-8 border-t border-white/10">
                            <a href="/docs/benchmarks" class="w-full text-brand-teal font-label-sm text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors flex items-center justify-center gap-2 group/btn">
                                View Technical Methodology
                                <ArrowRight :size="14" class="group-hover/btn:translate-x-1 transition-transform" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
