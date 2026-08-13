<script setup lang="ts">
import { artworkDisplayUrl } from '~/utils/networkedArt'

const props = defineProps<{
  href: string
  image?: string | null
  title?: string | null
  pending?: boolean
  width?: number | null
  height?: number | null
}>()

const displayImage = computed(() =>
  props.image ? artworkDisplayUrl(props.image) : null,
)

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
    v-if="displayImage"
    class="artwork-preview"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
  >
    <img
      :src="displayImage"
      :alt="title || 'Artwork preview'"
      :style="aspectStyle"
      :width="width || undefined"
      :height="height || undefined"
      referrerpolicy="no-referrer"
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
    Paste an Artwork URL to preview
  </p>
</template>
