<script setup lang="ts">
import { artworkPlatforms } from '~/utils/artworkPlatforms'
</script>

<template>
  <span
    class="artwork-platforms"
    role="group"
    aria-label="Supported platforms"
  >
    <span class="artwork-platforms__label">supports</span>
    <a
      v-for="platform in artworkPlatforms"
      :key="platform.name"
      class="artwork-platforms__mark"
      :href="platform.href"
      :title="platform.name"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img
        :src="platform.src"
        :alt="platform.name"
        width="16"
        height="16"
      >
    </a>
  </span>
</template>
