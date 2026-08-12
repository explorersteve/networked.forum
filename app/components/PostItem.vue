<script setup lang="ts">
import { forumPostPath, forumPostUrl, xPostIntentUrl } from '~/utils/forum'
import { stripArtworkPathFromText } from '~/utils/networkedArt'
import type { ForumPost } from '~/utils/forum'

const props = defineProps<{
  post: ForumPost
}>()

const config = useRuntimeConfig()
const { preview, pending } = useArtworkPreview(() =>
  props.post.imageUrl ? '' : props.post.url,
)

/** Path is kept in the tx payload but hidden in the feed. */
const displayText = computed(() => stripArtworkPathFromText(props.post.text))

const artworkTitle = computed(() => props.post.title || null)
const artworkArtist = computed(() => props.post.artist || null)
const artworkImage = computed(() => props.post.imageUrl || preview.value?.image || null)
const artworkPending = computed(() => !props.post.imageUrl && pending.value)

const postPath = computed(() => forumPostPath(props.post.txHash))
const permalink = computed(() => {
  const siteUrl = String(config.public.siteUrl || '').replace(/\/$/, '')
  if (siteUrl) {
    return forumPostUrl(siteUrl, props.post.txHash)
  }
  if (import.meta.client) {
    return `${window.location.origin}${postPath.value}`
  }
  return postPath.value
})

const xShareHref = computed(() => {
  const writing = displayText.value.trim()
  const credit =
    artworkTitle.value && artworkArtist.value
      ? `${artworkTitle.value} by ${artworkArtist.value}`
      : artworkTitle.value || ''
  return xPostIntentUrl(writing || credit, permalink.value)
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
        :image="artworkImage"
        :title="artworkTitle || preview?.title"
        :width="preview?.width"
        :height="preview?.height"
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
      <div class="post__byline-end">
        <a
          class="post__share-x"
          :href="xShareHref"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Post on X"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.837L1.254 2.25H8.08l4.253 5.922L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"
            />
          </svg>
        </a>
        <NuxtLink
          :to="postPath"
          class="post__permalink"
        >
          <time :datetime="new Date(post.timestamp * 1000).toISOString()">
            {{ formattedTime }}
          </time>
        </NuxtLink>
      </div>
    </div>
  </article>
</template>
