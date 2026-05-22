<script setup>
    const startYear = 2026
    const currentYear = new Date().getFullYear()
    const copyrightYear = currentYear > startYear ? `${startYear}–${currentYear}` : `${startYear}`
</script>

<template>
    <footer class="w-full bg-surface-container border-t border-outline-variant">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-[1280px] mx-auto py-12 px-10">
            <div class="space-y-4">
                <div class="font-label-md text-label-md font-bold text-brand-teal flex items-center gap-2">
                    <span class="material-symbols-outlined text-brand-teal">terminal</span>
                    Fastapi Starkit
                </div>
                <p class="text-body-sm font-body-sm text-on-surface-variant">
                    The high-performance architecture for modern software engineering. Engineered for reliability.
                </p>
            </div>
            <div class="space-y-4">
                <div class="font-label-sm text-label-sm text-on-surface font-bold uppercase tracking-widest">Resources</div>
                <ul class="space-y-2">
                    <li>
                        <a href="https://github.com/fastapi-startkit/fastapi-startkit" class="text-on-surface-variant hover:text-brand-teal hover:underline decoration-brand-teal transition-all text-body-sm font-body-sm">
                            Github
                        </a>
                    </li>
                </ul>
            </div>
            <!--                    <li>-->
            <!--                        <a class="text-on-surface-variant hover:text-brand-teal hover:underline decoration-brand-teal transition-all text-body-sm font-body-sm" href="#">Security Whitepaper</a>-->
            <!--                    </li>-->
            <!--                    <li>-->
            <!--                        <a class="text-on-surface-variant hover:text-brand-teal hover:underline decoration-brand-teal transition-all text-body-sm font-body-sm" href="#">Open Source</a>-->
            <!--                    </li>-->
            <!--                </ul>-->
            <!--            </div>-->
            <!--            <div class="space-y-4">-->
            <!--                <div class="font-label-sm text-label-sm text-on-surface font-bold uppercase tracking-widest">Infrastructure</div>-->
            <!--                <ul class="space-y-2">-->
            <!--                    <li>-->
            <!--                        <a class="text-on-surface-variant hover:text-brand-teal hover:underline decoration-brand-teal transition-all text-body-sm font-body-sm" href="#">Status</a>-->
            <!--                    </li>-->
            <!--                    <li>-->
            <!--                        <a class="text-on-surface-variant hover:text-brand-teal hover:underline decoration-brand-teal transition-all text-body-sm font-body-sm" href="#">Changelog</a>-->
            <!--                    </li>-->
            <!--                    <li>-->
            <!--                        <a class="text-on-surface-variant hover:text-brand-teal hover:underline decoration-brand-teal transition-all text-body-sm font-body-sm" href="#">Cloud Engine</a>-->
            <!--                    </li>-->
            <!--                </ul>-->
            <!--        </div>-->
            <!-- <div class="space-y-4">-->
            <!--     <div class="font-label-sm text-label-sm text-on-surface font-bold uppercase tracking-widest">Connect</div>-->
            <!--     <div class="flex gap-4">-->
            <!--         <span class="material-symbols-outlined text-brand-teal cursor-pointer hover:scale-110 transition-transform">terminal</span>-->
            <!--         <span class="material-symbols-outlined text-brand-teal cursor-pointer hover:scale-110 transition-transform">database</span>-->
            <!--         <span class="material-symbols-outlined text-brand-teal cursor-pointer hover:scale-110 transition-transform">cloud</span>-->
            <!--     </div>-->
            <!-- </div>-->
        </div>
        <div class="max-w-7xl mx-auto px-10 pb-12 border-t border-outline-variant/10 pt-8 flex justify-between items-center">
            <div class="font-label-sm text-label-sm text-on-surface-variant">
                © {{ copyrightYear }} FastAPI Startkit. Built for high-performance architects.
            </div>
            <!-- <div class="flex gap-8 text-[10px] text-on-surface-variant uppercase font-label-sm">-->
            <!--     <a class="hover:text-brand-teal transition-colors" href="#">Privacy</a>-->
            <!--     <a class="hover:text-brand-teal transition-colors" href="#">Terms</a>-->
            <!--     <a class="hover:text-brand-teal transition-colors" href="#">Compliance</a>-->
            <!-- </div>-->
        </div>
    </footer>
</template>
