<script setup lang="ts">
    import HomeAgents from "./HomeAgents.vue"
    import HomeBento from "./HomeBento.vue"
    import HomeCta from "./HomeCta.vue"
    import HomeFooter from "./HomeFooter.vue"
    import HomeHero from "./HomeHero.vue"
    import HomeLaravel from "./HomeLaravel.vue"
    import HomeMarquee from "./HomeMarquee.vue"
    import HomeProviders from "./HomeProviders.vue"
    import HomeSteps from "./HomeSteps.vue"
    import HomeTesting from "./HomeTesting.vue"
</script>

<template>
    <div class="hp">
        <HomeHero/>
        <HomeMarquee/>
        <HomeProviders/>
        <HomeBento/>
        <HomeAgents/>
        <HomeTesting/>
        <HomeLaravel/>
        <HomeSteps/>
        <HomeCta/>
        <HomeFooter/>
    </div>
</template>
