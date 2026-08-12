<script setup lang="ts">
const {
  posts,
  ready,
  error,
  configured,
  canLoadMore,
  loadMore,
} = useForumPosts()

useSeoMeta({
  title: 'Forum',
  description: 'An on-chain art forum.',
  ogTitle: 'Forum',
  ogDescription: 'An on-chain art forum.',
})
</script>

<template>
  <div class="app-main">
    <PostFeed
      :posts="posts"
      :can-load-more="canLoadMore"
      :ready="ready"
      :configured="configured"
      :error="error"
      @load-more="loadMore"
    />
  </div>
</template>
