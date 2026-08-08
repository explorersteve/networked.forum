<script setup lang="ts">
defineProps<{
  href: string
  image?: string | null
  title?: string | null
  pending?: boolean
}>()
</script>

<template>
  <a
    v-if="image"
    class="artwork-preview"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
  >
    <img
      :src="image"
      :alt="title || 'Artwork preview'"
      loading="lazy"
      decoding="async"
    />
  </a>

  <p
    v-else-if="pending"
    class="artwork-preview__loading"
  >
    Loading preview…
  </p>

  <p
    v-else
    class="artwork-preview__empty"
  >
    Paste a Networked.art artwork link to preview
  </p>
</template>
