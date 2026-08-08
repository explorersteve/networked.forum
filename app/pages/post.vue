<script setup lang="ts">
const { refresh, simulatePost } = useForumIndexer()

async function onPosted() {
  await refresh()
  await navigateTo('/')
}

async function onSimulate(input: { url?: string; text?: string }) {
  await simulatePost(input)
  await navigateTo('/')
}

useHead({
  title: 'New Post · Forum',
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
    <PostComposer
      @posted="onPosted"
      @simulate="onSimulate"
    />
  </div>
</template>
