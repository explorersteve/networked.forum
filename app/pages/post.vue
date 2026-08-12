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

    <footer class="about-footer" aria-labelledby="about-footer-heading">
      <p id="about-footer-heading" class="section-label">About</p>
      <div class="about-footer__body">
        <p>
          Every piece of writing published on Artforum is stored fully on-chain
          inside a single NFT owned by Stephen Santoro. Each writer retains full
          rights to their writing. Contributing to Artforum does not transfer
          copyright or ownership of the work itself. The NFT acts as the
          container for the forum: a collective record of every contribution
          written into it over time. Stephen’s intention is to eventually
          auction the token, allowing the forum itself, as a fully on-chain
          collective object, to change hands while the individual writers
          continue to retain the rights to their work.
        </p>
      </div>
    </footer>
  </div>
</template>
