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
                            <span class="text-brand-teal text-glow">Optimized for speed.</span>
                        </h2>
                        <p class="text-white/70 font-body-lg text-body-lg max-w-xl">
                            The Startkit isn't just a collection of libraries; it's a battle-tested architecture designed to handle thousands of concurrent requests with sub-millisecond overhead.
                        </p>
                    </div>

                    <ul class="space-y-8">
                        <li class="flex items-start gap-6 group/item">
                            <div class="mt-1 w-10 h-10 rounded bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center shrink-0 group-hover/item:bg-brand-teal/30 transition-colors">
                                <Gauge :size="20" class="text-brand-teal" />
                            </div>
                            <div class="space-y-1">
                                <h4 class="font-headline-md text-headline-md font-semibold text-white tracking-[-0.01em]">Zero-copy Processing</h4>
                                <p class="text-white/90 text-body-sm font-body-sm max-w-md">Leveraging memory-efficient serialization for lightning-fast data throughput across all system boundaries.</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-6 group/item">
                            <div class="mt-1 w-10 h-10 rounded bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center shrink-0 group-hover/item:bg-brand-teal/30 transition-colors">
                                <Shield :size="20" class="text-brand-teal" />
                            </div>
                            <div class="space-y-1">
                                <h4 class="font-headline-md text-headline-md font-semibold text-white tracking-[-0.01em]">Encrypted Pipelines</h4>
                                <p class="text-white/90 text-body-sm font-body-sm max-w-md">Hardware-accelerated TLS termination and internal secret management for uncompromising security at scale.</p>
                            </div>
                        </li>
                    </ul>
                </div>

                <!-- Right: Benchmark Card -->
                <div class="relative">
                    <div class="absolute -inset-10 bg-brand-teal/20 blur-[100px] rounded-full opacity-40"></div>
                    <div class="relative bg-slate-900/60 border border-brand-teal/20 p-10 rounded-xl backdrop-blur-xl shadow-[0_0_50px_rgba(5,150,105,0.1)]">
                        <div class="flex justify-between items-center mb-12">
                            <div class="flex items-center gap-3">
                                <div class="w-2 h-2 rounded-full bg-brand-teal animate-pulse"></div>
                                <div class="font-label-md text-label-md text-white/90 uppercase tracking-widest">Performance Benchmark</div>
                            </div>
                            <div class="text-brand-teal text-[10px] font-bold border border-brand-teal/40 px-2 py-0.5 rounded uppercase tracking-tighter">Real-time</div>
                        </div>

                        <div class="space-y-10">
                            <!-- FastAPI Startkit -->
                            <div class="space-y-3">
                                <div class="flex justify-between text-[11px] font-label-sm uppercase tracking-wider text-outline-variant">
                                    <span class="text-white font-bold">FastAPI Startkit</span>
                                    <span class="text-brand-teal font-bold">94,203 req/s</span>
                                </div>
                                <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <div class="h-full bg-gradient-to-r from-brand-teal/50 to-brand-teal w-[95%] shadow-[0_0_15px_rgba(5,153,139,0.5)] transition-all duration-1000"></div>
                                </div>
                            </div>

                            <!-- Django -->
                            <div class="space-y-3">
                                <div class="flex justify-between text-[11px] font-label-sm uppercase tracking-wider text-white/60">
                                    <span>Django Gunicorn</span>
                                    <span class="text-white/60">12,180 req/s</span>
                                </div>
                                <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div class="h-full bg-white/10 w-[20%]"></div>
                                </div>
                            </div>

                            <!-- Express -->
                            <div class="space-y-3">
                                <div class="flex justify-between text-[11px] font-label-sm uppercase tracking-wider text-white/60">
                                    <span>Express.js Cluster</span>
                                    <span class="text-white/60">41,500 req/s</span>
                                </div>
                                <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div class="h-full bg-white/20 w-[45%]"></div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-14 pt-8 border-t border-white/10">
                            <button class="w-full text-brand-teal font-label-sm text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors flex items-center justify-center gap-2 group/btn">
                                View Technical Methodology
                                <ArrowRight :size="14" class="group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
