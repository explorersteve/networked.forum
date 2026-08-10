const NETWORKED_HOST = 'networked.art'
const NETWORKED_ORIGIN = `https://${NETWORKED_HOST}`

/** e.g. sheipiter/0x0f650438d8689a2e2e800b31b36b02294e314b0c/2 */
const ARTWORK_PATH_RE =
  /^([a-zA-Z0-9_-]+)\/(0x[a-fA-F0-9]{40})\/(\d+)$/

export function extractNetworkedArtPath(value: string): string | null {
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
  const match = path.match(ARTWORK_PATH_RE)
  const artist = match?.[1]
  const contract = match?.[2]
  const tokenId = match?.[3]
  if (!artist || !contract || !tokenId) {
    return null
  }

  return `${artist}/${contract.toLowerCase()}/${tokenId}`
}

export function buildNetworkedArtUrl(path: string): string | null {
  const artworkPath = extractNetworkedArtPath(path)
  if (!artworkPath) {
    return null
  }
  return `${NETWORKED_ORIGIN}/${artworkPath}`
}

export function artistSlugFromPath(path: string): string | null {
  const artworkPath = extractNetworkedArtPath(path)
  if (!artworkPath) {
    return null
  }
  return artworkPath.split('/')[0] ?? null
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
