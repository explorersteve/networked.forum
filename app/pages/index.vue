<script setup lang="ts">
const {
  posts,
  status,
  ready,
  error,
  configured,
  canLoadMore,
  loadMore,
} = useForumIndexer()

const statusLabel = computed(() => {
  if (!status.value) {
    return null
  }

  if (status.value.phase === 'backfilling') {
    const progress = Math.round((status.value.progress || 0) * 100)
    return `Indexing posts… ${progress}%`
  }

  if (status.value.phase === 'live') {
    return null
  }

  return `Indexer: ${status.value.phase}`
})

useHead({
  title: 'Forum',
  meta: [
    {
      name: 'description',
      content: 'Paste a Networked.art link, write about it, and post onchain.',
    },
  ],
})
</script>

<template>
  <div class="app-main">
    <PostFeed
      :posts="posts"
      :can-load-more="canLoadMore"
      :ready="ready"
      :configured="configured"
      :status-label="statusLabel"
      :error="error"
      @load-more="loadMore"
    />
  </div>
</template>
