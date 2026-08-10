<script setup lang="ts">
import { stripArtworkPathFromText } from '~/utils/networkedArt'
import type { ForumPost } from '~/utils/forum'

const props = defineProps<{
  post: ForumPost
}>()

const { preview, pending } = useArtworkPreview(() =>
  props.post.imageUrl ? '' : props.post.url,
)

/** Path is kept in the tx payload but hidden in the feed. */
const displayText = computed(() => stripArtworkPathFromText(props.post.text))

const artworkTitle = computed(() => props.post.title || null)
const artworkArtist = computed(() => props.post.artist || null)
const artworkImage = computed(() => props.post.imageUrl || preview.value?.image || null)
const artworkPending = computed(() => !props.post.imageUrl && pending.value)

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
        :image="artworkImage"
        :title="artworkTitle || preview?.title"
        :pending="artworkPending"
      />

      <div
        v-if="artworkTitle || artworkArtist"
        class="post__artwork-credit"
      >
        <p
          v-if="artworkTitle"
          class="post__artwork-title"
        >
          {{ artworkTitle }}
        </p>
        <p
          v-if="artworkArtist"
          class="post__artwork-artist"
        >
          by {{ artworkArtist }}
        </p>
      </div>
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
