<script setup lang="ts">
const props = defineProps<{
  href: string
  image?: string | null
  title?: string | null
  pending?: boolean
  width?: number | null
  height?: number | null
}>()

const aspectStyle = computed(() => {
  if (!props.width || !props.height) {
    return undefined
  }
  return { aspectRatio: `${props.width} / ${props.height}` }
})

function onImageLoad(event: Event) {
  const img = event.target
  if (!(img instanceof HTMLImageElement)) {
    return
  }
  if (props.width && props.height) {
    return
  }
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`
  }
}
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
      :style="aspectStyle"
      :width="width || undefined"
      :height="height || undefined"
      loading="lazy"
      decoding="async"
      @load="onImageLoad"
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
    Paste a Networked.art or OpenSea artwork link to preview
  </p>
</template>
