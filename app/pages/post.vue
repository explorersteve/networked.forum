<script setup lang="ts">
async function onPosted() {
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
    <PostComposer @posted="onPosted" />
  </div>
</template>
