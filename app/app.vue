<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = String(config.public.siteUrl || 'https://www.artforum.fun').replace(
  /\/$/,
  '',
)
const ogImage = `${siteUrl}/og.png`
const description = 'An on-chain art forum.'

useHead({
  link: [
    {
      rel: 'icon',
      type: 'image/svg+xml',
      href: '/black-squares-f.svg',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossorigin: '',
    },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap',
    },
  ],
})

useSeoMeta({
  title: 'Forum',
  description,
  ogTitle: 'Forum',
  ogDescription: description,
  ogImage,
  ogUrl: siteUrl,
  ogType: 'website',
  ogSiteName: 'Forum',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Forum',
  twitterDescription: description,
  twitterImage: ogImage,
})
</script>

<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <AppHeader />
    <NuxtPage />
  </div>
</template>
