<script setup lang="ts">
import { parseArtworkTitle, stripArtworkPathFromText } from '~/utils/networkedArt'

const props = defineProps<{
  post: {
    id: string
    author: `0x${string}`
    url: string
    text: string
    timestamp: number
  }
}>()

const { preview, pending } = useArtworkPreview(() => props.post.url)

/** Path is kept in the tx payload but hidden in the feed. */
const displayText = computed(() => stripArtworkPathFromText(props.post.text))

const artworkMeta = computed(() => parseArtworkTitle(preview.value?.title))

const artworkCredit = computed(() => {
  const { title, artist } = artworkMeta.value
  if (title && artist) {
    return `${title} by ${artist}`
  }
  return title || artist || null
})

const formattedTime = computed(() => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(props.post.timestamp * 1000))
  } catch {
    return String(props.post.timestamp)
  }
})
</script>

<template>
  <article class="post">
    <div
      v-if="displayText"
      class="post__text"
    >
      <p>{{ displayText }}</p>
    </div>

    <div class="post__artwork">
      <ArtworkPreview
        :href="post.url"
        :image="preview?.image"
        :title="preview?.title"
        :pending="pending"
      />

      <p
        v-if="artworkCredit"
        class="post__artwork-credit"
      >
        {{ artworkCredit }}
      </p>
    </div>

    <div class="post__byline">
      <EvmAccount
        :address="post.author"
        resolve-ens
      />
      <time :datetime="new Date(post.timestamp * 1000).toISOString()">
        {{ formattedTime }}
      </time>
    </div>
  </article>
</template>
