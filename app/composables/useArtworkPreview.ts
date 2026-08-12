import { normalizeArtworkUrl } from '~/utils/networkedArt'

export type ArtworkPreview = {
  url: string
  title: string | null
  image: string | null
  width: number | null
  height: number | null
}

export function useArtworkPreview(urlSource: MaybeRefOrGetter<string>) {
  const normalizedUrl = computed(() => normalizeArtworkUrl(toValue(urlSource) || ''))
  const preview = ref<ArtworkPreview | null>(null)
  const pending = ref(false)
  const error = ref<Error | null>(null)
  let requestId = 0

  async function refresh() {
    const url = normalizedUrl.value
    const current = ++requestId

    if (!url) {
      preview.value = null
      error.value = null
      pending.value = false
      return
    }

    pending.value = true
    error.value = null

    try {
      const result = await $fetch<ArtworkPreview>('/api/preview', {
        query: { url },
      })

      if (current === requestId) {
        preview.value = result
      }
    } catch (err) {
      if (current === requestId) {
        preview.value = null
        error.value = err instanceof Error ? err : new Error('Preview failed')
      }
    } finally {
      if (current === requestId) {
        pending.value = false
      }
    }
  }

  watch(normalizedUrl, () => {
    void refresh()
  }, { immediate: true })

  return {
    preview,
    pending,
    error,
    refresh,
    normalizedUrl,
  }
}
