<template>
    <section class="py-32 bg-surface">
        <div class="max-w-7xl mx-auto px-10">
            <div class="text-center mb-20 space-y-4">
                <span class="text-brand-teal font-label-sm text-label-sm uppercase tracking-[0.3em] font-bold">Global Benchmarks</span>
                <h2 class="font-headline-lg text-headline-lg font-semibold text-on-surface tracking-[-0.02em]">Validated by Lead Architects</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Testimonial cards -->
                <div
                    v-for="(person, idx) in testimonials"
                    :key="idx"
                    class="bg-white border border-outline-variant rounded-lg overflow-hidden flex flex-col hover:border-brand-teal transition-all hover:shadow-xl hover:shadow-brand-teal/5 group"
                >
                    <div class="p-6 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                        <div class="flex gap-1.5">
                            <div class="w-2 h-2 rounded-full bg-brand-teal/40"></div>
                            <div class="w-2 h-2 rounded-full bg-brand-teal/40"></div>
                            <div class="w-2 h-2 rounded-full bg-brand-teal/40"></div>
                        </div>
                        <span class="text-[10px] font-label-sm text-brand-teal font-bold uppercase tracking-wider">Status: Verified</span>
                    </div>
                    <div class="p-8 space-y-8 flex-1 flex flex-col">
                        <div class="flex items-center gap-4">
                            <img
                                :alt="person.name"
                                class="w-14 h-14 rounded grayscale group-hover:grayscale-0 transition-all border border-outline-variant p-0.5"
                                :src="person.avatar"
                            />
                            <div class="space-y-1">
                                <div class="font-bold text-on-surface text-base">{{ person.name }}</div>
                                <div class="inline-flex items-center px-2 py-0.5 bg-brand-teal/10 text-brand-teal rounded text-[10px] font-bold uppercase">{{ person.role }}</div>
                            </div>
                        </div>
                        <p class="text-on-surface font-body-md text-body-md italic leading-relaxed">"{{ person.quote }}"</p>
                        <div class="mt-auto pt-6 border-t border-outline-variant/30 flex justify-between items-center">
                            <div class="text-[10px] text-on-surface-variant font-label-sm uppercase tracking-widest">{{ person.metricLabel }}</div>
                            <div class="text-brand-teal font-bold text-sm">{{ person.metricValue }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup>
    const testimonials = [
        {
            name: "Sajan Lamsal",
            role: "CTO, JoBins",
            avatar: "https://placehold.co/56x56",
            quote: "FastAPI Startkit gave us the foundation to move from idea to production in record time. The architecture decisions it enforces have kept our codebase clean as the team scaled.",
            metricLabel: "Time to Production",
            metricValue: "-60%",
        },
        {
            name: "Puncoz Nepal",
            role: "Lead Software Engineer, JoBins",
            avatar: "https://placehold.co/56x56",
            quote: "The developer experience is unmatched. Structured providers, clean routing, and a first-class ORM — everything fits together exactly how you'd expect it to.",
            metricLabel: "Dev Onboarding",
            metricValue: "2× Faster",
        },
        {
            name: "Kiran Prajapati",
            role: "Lead AI Engineer, JoBins",
            avatar: "https://placehold.co/56x56",
            quote: "Integrating async ML pipelines and LLM endpoints into FastAPI Startkit was seamless. The fully async core handles concurrent inference workloads without breaking a sweat.",
            metricLabel: "Inference Throughput",
            metricValue: "+3× Gain",
        },
    ]
</script>
