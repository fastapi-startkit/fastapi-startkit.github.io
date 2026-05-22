<script setup>
import DefaultTheme from 'vitepress/theme'
import SiteHeader from './components/SiteHeader.vue'
import HeroSection from './components/HeroSection.vue'
import LogoStrip from './components/LogoStrip.vue'
import CoreModules from './components/CoreModules.vue'
import PerformanceBenchmarks from './components/PerformanceBenchmarks.vue'
import Testimonials from './components/Testimonials.vue'
import FinalCTA from './components/FinalCTA.vue'
import SiteFooter from './components/SiteFooter.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #layout-top>
      <SiteHeader />
    </template>
    <template #home-hero-before>
      <HeroSection />
      <LogoStrip />
      <CoreModules />
      <PerformanceBenchmarks />
      <Testimonials />
      <FinalCTA />
      <SiteFooter />
    </template>
  </Layout>
</template>
