<script setup lang="ts">
const {
  posts,
  ready,
  error,
  configured,
  canLoadMore,
  loadMore,
} = useForumPosts()

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
      :error="error"
      @load-more="loadMore"
    />
  </div>
</template>
