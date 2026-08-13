import type { Hash } from 'viem'
import { api } from '../../convex/_generated/api'
import { isForumConfigured, toForumPost, type ForumPost } from '~/utils/forum'
import { parseArtworkTitle } from '~/utils/networkedArt'

const PAGE_SIZE = 12

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useForumPosts() {
  const runtimeConfig = useRuntimeConfig()
  const visibleCount = ref(PAGE_SIZE)

  const contractAddress = computed(() => {
    const value = runtimeConfig.public.forum.contractAddress
    return isForumConfigured(value) ? value : null
  })

  const configured = computed(() => Boolean(contractAddress.value))

  const limit = computed(() => Math.min(Math.max(visibleCount.value, PAGE_SIZE), 100))

  const { data, error, isPending } = useConvexQuery(api.posts.listRecent, () => ({
    limit: limit.value,
  }))

  const posts = computed<ForumPost[]>(() => {
    const rows = data.value ?? []
    return rows.map(toForumPost)
  })

  const ready = computed(() => !isPending.value || data.value !== undefined)
  const canLoadMore = computed(() => {
    const rows = data.value
    if (!rows) {
      return false
    }
    return rows.length >= limit.value && limit.value < 100
  })

  function loadMore() {
    if (!canLoadMore.value) {
      return
    }
    visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, 100)
  }

  const client = useConvexClient()

  /**
   * Store the full embed URL before the transaction confirms — the onchain
 * payload only keeps `0xcontract/tokenId`. Networked.art 404s without the
 * slug, and marketplace links cannot be rebuilt from the path alone. Best
   * effort: never block posting on it.
   */
  async function rememberArtworkUrl(url: string) {
    try {
      await client.mutation(api.posts.rememberArtworkUrl, { url })
    } catch (err) {
      console.error('Failed to remember artwork URL', err)
    }
  }

  async function indexConfirmedPost(input: {
    txHash: Hash
    titleHint?: string | null
    artistHint?: string | null
    imageUrlHint?: string | null
    urlHint?: string | null
  }) {
    const parsedHint = parseArtworkTitle(input.titleHint)
    const args = {
      txHash: input.txHash,
      titleHint: parsedHint.title || input.titleHint || undefined,
      artistHint: input.artistHint || parsedHint.artist || undefined,
      imageUrlHint: input.imageUrlHint || undefined,
      urlHint: input.urlHint || undefined,
    }

    let lastError: unknown
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await client.mutation(api.posts.requestIndex, args)
        return
      } catch (err) {
        lastError = err
        try {
          await client.action(api.postsActions.indexFromTxPublic, args)
          return
        } catch (actionErr) {
          lastError = actionErr
        }
        await sleep(400 * (attempt + 1))
      }
    }

    console.error('Failed to index post into Convex', lastError)
    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to index post')
  }

  return {
    posts,
    ready,
    error: computed(() => (error.value ? error.value.message : null)),
    configured,
    canLoadMore,
    loadMore,
    indexConfirmedPost,
    rememberArtworkUrl,
  }
}
