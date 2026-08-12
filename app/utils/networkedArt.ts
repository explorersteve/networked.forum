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

export function isNetworkedArtUrl(value: string): boolean {
  return normalizeNetworkedArtUrl(value) !== null
}

/**
 * Onchain / composer path: `{0xcontract}/{tokenId}` (artist slug omitted).
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

export function normalizeNetworkedArtUrl(value: string): string | null {
  return buildNetworkedArtUrl(value)
}

/**
 * Remove onchain envelope lines from post text for feed display:
 * leading artwork path and trailing wallet/ENS signature.
 * Those lines remain in the onchain `text` payload.
 */
export function stripArtworkPathFromText(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let start = 0
  let end = lines.length

  const first = lines[0]?.trim() ?? ''
  if (extractNetworkedArtPath(first)) {
    start = 1
    while (start < end && !lines[start]?.trim()) {
      start += 1
    }
  }

  const last = lines[end - 1]?.trim() ?? ''
  if (end > start && isAuthorSignatureLine(last)) {
    end -= 1
    while (end > start && !lines[end - 1]?.trim()) {
      end -= 1
    }
  }

  return lines.slice(start, end).join('\n').trim()
}

/** Trailing onchain signature: ENS name or bare 0x address. */
function isAuthorSignatureLine(line: string): boolean {
  const trimmed = line.trim()
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return true
  }
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/i.test(trimmed)
}

/**
 * Networked.art OG images are branded 1200x630 cards. The real artwork URL is
 * embedded as a base64 segment after `src_~` inside `/_og/` paths.
 */
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
    const decoded = globalThis.atob(padded)

    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded
    }

    return ogImage
  } catch {
    return ogImage
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
