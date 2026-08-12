const NETWORKED_HOST = 'networked.art'
const NETWORKED_ORIGIN = `https://${NETWORKED_HOST}`

/** URL/path with artist slug: sheipiter/0x…/2 */
const ARTWORK_PATH_WITH_ARTIST_RE =
  /^([a-zA-Z0-9_-]+)\/(0x[a-fA-F0-9]{40})\/(\d+)$/
/** Onchain path (no artist): 0x…/2 */
const ARTWORK_PATH_RE = /^(0x[a-fA-F0-9]{40})\/(\d+)$/

type ParsedArtwork = {
  artist: string | null
  contract: string
  tokenId: string
}

function parseArtworkInput(value: string): ParsedArtwork | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  let pathname = trimmed

  try {
    const hasScheme = /^https?:\/\//i.test(trimmed)
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    const host = url.hostname.replace(/^www\./, '')
    if (host === NETWORKED_HOST) {
      pathname = url.pathname
    } else if (hasScheme) {
      return null
    }
  } catch {
    // Treat as a bare path below.
  }

  const path = pathname.replace(/^\/+|\/+$/g, '')
  const withArtist = path.match(ARTWORK_PATH_WITH_ARTIST_RE)
  if (withArtist?.[1] && withArtist[2] && withArtist[3]) {
    return {
      artist: withArtist[1],
      contract: withArtist[2].toLowerCase(),
      tokenId: withArtist[3],
    }
  }

  const bare = path.match(ARTWORK_PATH_RE)
  if (bare?.[1] && bare[2]) {
    return {
      artist: null,
      contract: bare[1].toLowerCase(),
      tokenId: bare[2],
    }
  }

  return null
}

/**
 * Onchain path: `{0xcontract}/{tokenId}` (artist slug omitted).
 * Accepts a full Networked.art URL, `{artist}/0x…/id`, or bare `0x…/id`.
 */
export function extractNetworkedArtPath(value: string): string | null {
  const parsed = parseArtworkInput(value)
  if (!parsed) {
    return null
  }
  return `${parsed.contract}/${parsed.tokenId}`
}

/**
 * Build an embeddable Networked.art URL. Keeps the artist slug when present
 * in the input (needed for page fetch / OG preview).
 */
export function buildNetworkedArtUrl(path: string): string | null {
  const parsed = parseArtworkInput(path)
  if (!parsed) {
    return null
  }
  if (parsed.artist) {
    return `${NETWORKED_ORIGIN}/${parsed.artist}/${parsed.contract}/${parsed.tokenId}`
  }
  return `${NETWORKED_ORIGIN}/${parsed.contract}/${parsed.tokenId}`
}

export function artistSlugFromPath(path: string): string | null {
  return parseArtworkInput(path)?.artist ?? null
}

/** Contract + token behind an artwork URL or path, for onchain lookups. */
export function parseArtworkRef(
  value: string,
): { contract: `0x${string}`; tokenId: bigint } | null {
  const parsed = parseArtworkInput(value)
  if (!parsed) {
    return null
  }
  try {
    return {
      contract: parsed.contract as `0x${string}`,
      tokenId: BigInt(parsed.tokenId),
    }
  } catch {
    return null
  }
}

/**
 * Networked.art packs title + artist into one string, e.g.
 * "everyone who was there by INFINITEYAY"
 */
export function parseArtworkTitle(ogTitle: string | null | undefined): {
  title: string | null
  artist: string | null
} {
  if (!ogTitle?.trim()) {
    return { title: null, artist: null }
  }

  const trimmed = ogTitle.trim()
  const match = trimmed.match(/^(.+?)\s+by\s+(.+)$/i)
  if (!match?.[1] || !match[2]) {
    return { title: trimmed, artist: null }
  }

  return {
    title: match[1].trim(),
    artist: match[2].trim(),
  }
}

export function unwrapNetworkedOgImage(ogImage: string): string {
  try {
    const url = new URL(ogImage)
    if (!url.hostname.endsWith(NETWORKED_HOST)) {
      return ogImage
    }

    const match = url.pathname.match(/src_~([A-Za-z0-9_-]+)/)
    if (!match?.[1]) {
      return ogImage
    }

    const encoded = match[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4)
    const decoded = Buffer.from(padded, 'base64').toString('utf8')

    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded
    }

    return ogImage
  } catch {
    return ogImage
  }
}

const GENERIC_OG_PATHS = new Set([
  '/og.png',
  '/og.jpg',
  '/og.webp',
  '/logo.svg',
  '/logo.png',
])

/** Site-wide Networked.art fallback (the letter-grid logo), not the artwork. */
export function isGenericNetworkedOgImage(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl)
    const host = url.hostname.replace(/^www\./, '')
    if (host !== NETWORKED_HOST) {
      return false
    }
    const path = url.pathname.replace(/\/+$/, '') || '/'
    return GENERIC_OG_PATHS.has(path.toLowerCase())
  } catch {
    return false
  }
}

export function isGenericNetworkedTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) {
    return true
  }
  const normalized = title.trim().toLowerCase()
  return normalized === 'networked.art' || normalized === 'networked'
}

/** Prefer the page's CDN/IPFS artwork when OG tags are the site default. */
export function extractArtworkImageFromHtml(html: string): string | null {
  const cdn = html.match(/https:\/\/cdn\.evm\.now\/tokens\/[a-fA-F0-9]+_md\.webp/i)
  if (cdn?.[0]) {
    return cdn[0]
  }
  const ipfs = html.match(/https:\/\/ipfs\.networked\.art\/ipfs\/[A-Za-z0-9]+/)
  if (ipfs?.[0]) {
    return ipfs[0]
  }
  return null
}

export function resolveArtworkImageFromHtml(html: string): string | null {
  const ogImage =
    extractMetaContent(html, 'og:image') ||
    extractMetaContent(html, 'twitter:image')
  if (ogImage) {
    const unwrapped = unwrapNetworkedOgImage(ogImage)
    if (
      !isGenericNetworkedOgImage(ogImage) &&
      !isGenericNetworkedOgImage(unwrapped)
    ) {
      return unwrapped
    }
  }
  return extractArtworkImageFromHtml(html)
}

export function resolveArtworkTitleFromHtml(html: string): string | null {
  const ogTitle =
    extractMetaContent(html, 'og:title') ||
    extractMetaContent(html, 'twitter:title')
  if (ogTitle && !isGenericNetworkedTitle(ogTitle)) {
    return ogTitle
  }
  return null
}

export function extractMetaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
      'i',
    ),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return decodeHtmlEntities(match[1])
    }
  }

  return null
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
