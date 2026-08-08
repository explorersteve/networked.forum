<script setup lang="ts">
import type { ForumPost } from '~/utils/forum'

const props = defineProps<{
  posts: ForumPost[]
  canLoadMore: boolean
  ready: boolean
  configured: boolean
  statusLabel?: string | null
  error?: string | null
}>()

const emit = defineEmits<{
  loadMore: []
}>()

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!import.meta.client || !sentinel.value) {
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting) && props.canLoadMore) {
        emit('loadMore')
      }
    },
    { rootMargin: '240px 0px' },
  )

  observer.observe(sentinel.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <section class="feed">
    <p class="section-label">Recent posts</p>

    <p
      v-if="error"
      class="feed__status"
    >
      {{ error }}
    </p>

    <p
      v-else-if="!ready"
      class="feed__status"
    >
      {{ statusLabel || 'Indexing posts…' }}
    </p>

    <p
      v-else-if="posts.length === 0 && !configured"
      class="feed__empty"
    >
      No posts yet. Use Post → Simulate post to preview the reader feed, or set
      <code>NUXT_PUBLIC_FORUM_CONTRACT_ADDRESS</code>
      after deploying.
    </p>

    <p
      v-else-if="posts.length === 0"
      class="feed__empty"
    >
      No posts yet. Connect a wallet and publish the first one.
    </p>

    <div
      v-else
      class="feed__grid"
    >
      <PostItem
        v-for="post in posts"
        :key="post.id"
        :post="post"
      />
    </div>

    <div
      ref="sentinel"
      class="feed__sentinel"
      aria-hidden="true"
    />

    <p
      v-if="canLoadMore"
      class="feed__status"
    >
      Loading more…
    </p>
  </section>
</template>
