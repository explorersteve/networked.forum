<script setup lang="ts">
import { forumPostUrl, isTxHash } from '~/utils/forum'
import { stripArtworkPathFromText } from '~/utils/networkedArt'

const route = useRoute()
const config = useRuntimeConfig()
const siteUrl = String(config.public.siteUrl || 'https://www.artforum.fun').replace(
  /\/$/,
  '',
)
const defaultOgImage = `${siteUrl}/og.png`
const txHash = computed(() => String(route.params.txHash || ''))
const { post, ready, valid, error, suspense } = useForumPost(txHash)

if (import.meta.server && isTxHash(txHash.value)) {
  try {
    await suspense()
  } catch {
    // Render the not-found / error state below.
  }
}

const permalink = computed(() => forumPostUrl(siteUrl, txHash.value))
const pageTitle = computed(() => {
  if (!post.value) {
    return 'Post · Forum'
  }
  if (post.value.title) {
    return `${post.value.title} · Forum`
  }
  return 'Post · Forum'
})
const pageDescription = computed(() => {
  const text = stripArtworkPathFromText(post.value?.text ?? '').trim()
  if (text) {
    return text.slice(0, 180)
  }
  if (post.value?.title && post.value.artist) {
    return `${post.value.title} by ${post.value.artist}`
  }
  return 'An on-chain art forum.'
})
const pageImage = computed(() => post.value?.imageUrl || defaultOgImage)

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogImage: pageImage,
  ogUrl: permalink,
  ogType: 'article',
  twitterCard: 'summary_large_image',
  twitterTitle: pageTitle,
  twitterDescription: pageDescription,
  twitterImage: pageImage,
})

useHead(() => ({
  link: [{ rel: 'canonical', href: permalink.value }],
}))
</script>

<template>
  <div class="app-main">
    <section class="feed">
      <p class="section-label">
        Post
      </p>

      <p
        v-if="error"
        class="feed__status"
      >
        {{ error }}
      </p>

      <p
        v-else-if="!valid"
        class="feed__empty"
      >
        This post link is invalid.
      </p>

      <p
        v-else-if="!ready"
        class="feed__status"
      >
        Loading post…
      </p>

      <p
        v-else-if="!post"
        class="feed__empty"
      >
        This post was not found.
      </p>

      <div
        v-else
        class="feed__grid"
      >
        <PostItem :post="post" />
      </div>
    </section>
  </div>
</template>
