import {
  extractMetaContent,
  normalizeNetworkedArtUrl,
  unwrapNetworkedOgImage,
} from '~/utils/networkedArt'

type PreviewResult = {
  url: string
  title: string | null
  image: string | null
}

const cache = new Map<string, { expiresAt: number; value: PreviewResult }>()
const CACHE_TTL_MS = 10 * 60_000

export default defineEventHandler(async (event): Promise<PreviewResult> => {
  const query = getQuery(event)
  const rawUrl = typeof query.url === 'string' ? query.url : ''
  const url = normalizeNetworkedArtUrl(rawUrl)

  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a valid https://networked.art artwork URL',
    })
  }

  const cached = cache.get(url)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'ForumPreview/1.0',
    },
  })

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to fetch artwork page (${response.status})`,
    })
  }

  const html = await response.text()
  const ogImage = extractMetaContent(html, 'og:image')
  const title =
    extractMetaContent(html, 'og:title') || extractMetaContent(html, 'twitter:title')

  const result: PreviewResult = {
    url,
    title,
    image: ogImage ? unwrapNetworkedOgImage(ogImage) : null,
  }

  cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, value: result })
  return result
})
