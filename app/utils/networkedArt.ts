const NETWORKED_HOST = 'networked.art'
const NETWORKED_ORIGIN = `https://${NETWORKED_HOST}`
const OPENSEA_HOST = 'opensea.io'
const OPENSEA_TESTNET_HOST = 'testnets.opensea.io'
const OPENSEA_HOSTS = new Set([OPENSEA_HOST, OPENSEA_TESTNET_HOST])
const ARTBLOCKS_HOST = 'artblocks.io'
const ARTBLOCKS_TOKEN_HOST = 'token.artblocks.io'
const ARTBLOCKS_HOSTS = new Set([ARTBLOCKS_HOST, ARTBLOCKS_TOKEN_HOST])
const ARTBLOCKS_ORIGIN = `https://www.${ARTBLOCKS_HOST}`
const ARTBLOCKS_TOKEN_API_ORIGIN = `https://${ARTBLOCKS_TOKEN_HOST}`
const TRANSIENT_HOST = 'transient.xyz'
const TRANSIENT_ORIGIN = `https://www.${TRANSIENT_HOST}`
const TRANSIENT_IMAGE_ORIGIN = 'https://img.transient.xyz'
const TRANSIENT_PROXY_HOSTS = new Set([
  'img.transient.xyz',
  'ipfs.transientusercontent.xyz',
  'dae.transientusercontent.xyz',
])

/** URL/path with artist slug: sheipiter/0x…/2 */
const ARTWORK_PATH_WITH_ARTIST_RE =
  /^([a-zA-Z0-9_-]+)\/(0x[a-fA-F0-9]{40})\/(\d+)$/
/** Onchain path (no artist): 0x…/2 */
const ARTWORK_PATH_RE = /^(0x[a-fA-F0-9]{40})\/(\d+)$/
/** /item|assets/{chain}/{contract}/{tokenId}, optional locale prefix */
const OPENSEA_CHAIN_ITEM_RE =
  /^(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:item|assets)\/([a-z0-9-]+)\/(0x[a-fA-F0-9]{40})\/(\d+)$/i
/** Legacy /assets/{contract}/{tokenId} (ethereum implied) */
const OPENSEA_LEGACY_ITEM_RE =
  /^(?:[a-z]{2}(?:-[a-z]{2})?\/)?assets\/(0x[a-fA-F0-9]{40})\/(\d+)$/i
/** /token/{chainId}/{contract}/{tokenId}, or API path without `token/` */
const ARTBLOCKS_TOKEN_RE =
  /^(?:token\/)?(\d+)\/(0x[a-fA-F0-9]{40})\/(\d+)$/i
/** /nfts/{chain}/{contract}/{tokenId} */
const TRANSIENT_NFT_RE =
  /^nfts\/([a-z0-9-]+)\/(0x[a-fA-F0-9]{40})\/(\d+)$/i

type ArtworkSource = 'networked' | 'opensea' | 'artblocks' | 'transient'

type ParsedArtwork = {
  artist: string | null
  contract: string
  tokenId: string
  source: ArtworkSource
  chain: string | null
  testnet: boolean
}

function parseOpenSeaPath(
  pathname: string,
  testnet: boolean,
): ParsedArtwork | null {
  const path = pathname.replace(/^\/+|\/+$/g, '')
  const chained = path.match(OPENSEA_CHAIN_ITEM_RE)
  if (chained?.[1] && chained[2] && chained[3]) {
    const chain = chained[1].toLowerCase()
    if (chain.startsWith('0x')) {
      return null
    }
    return {
      artist: null,
      contract: chained[2].toLowerCase(),
      tokenId: chained[3],
      source: 'opensea',
      chain,
      testnet,
    }
  }

  const legacy = path.match(OPENSEA_LEGACY_ITEM_RE)
  if (legacy?.[1] && legacy[2]) {
    return {
      artist: null,
      contract: legacy[1].toLowerCase(),
      tokenId: legacy[2],
      source: 'opensea',
      chain: testnet ? 'sepolia' : 'ethereum',
      testnet,
    }
  }

  return null
}

function parseArtBlocksPath(pathname: string): ParsedArtwork | null {
  const path = pathname.replace(/^\/+|\/+$/g, '')
  const match = path.match(ARTBLOCKS_TOKEN_RE)
  if (!match?.[1] || !match[2] || !match[3]) {
    return null
  }
  return {
    artist: null,
    contract: match[2].toLowerCase(),
    tokenId: match[3],
    source: 'artblocks',
    chain: match[1],
    testnet: false,
  }
}

function parseTransientPath(pathname: string): ParsedArtwork | null {
  const path = pathname.replace(/^\/+|\/+$/g, '')
  const match = path.match(TRANSIENT_NFT_RE)
  if (!match?.[1] || !match[2] || !match[3]) {
    return null
  }
  const chain = match[1].toLowerCase()
  if (chain.startsWith('0x')) {
    return null
  }
  return {
    artist: null,
    contract: match[2].toLowerCase(),
    tokenId: match[3],
    source: 'transient',
    chain,
    testnet: false,
  }
}

function parseNetworkedPath(pathname: string): ParsedArtwork | null {
  const path = pathname.replace(/^\/+|\/+$/g, '')
  const withArtist = path.match(ARTWORK_PATH_WITH_ARTIST_RE)
  if (withArtist?.[1] && withArtist[2] && withArtist[3]) {
    return {
      artist: withArtist[1],
      contract: withArtist[2].toLowerCase(),
      tokenId: withArtist[3],
      source: 'networked',
      chain: null,
      testnet: false,
    }
  }

  const bare = path.match(ARTWORK_PATH_RE)
  if (bare?.[1] && bare[2]) {
    return {
      artist: null,
      contract: bare[1].toLowerCase(),
      tokenId: bare[2],
      source: 'networked',
      chain: null,
      testnet: false,
    }
  }

  return null
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
    } else if (OPENSEA_HOSTS.has(host)) {
      return parseOpenSeaPath(url.pathname, host === OPENSEA_TESTNET_HOST)
    } else if (ARTBLOCKS_HOSTS.has(host)) {
      return parseArtBlocksPath(url.pathname)
    } else if (host === TRANSIENT_HOST) {
      return parseTransientPath(url.pathname)
    } else if (hasScheme) {
      return null
    }
  } catch {
    // Treat as a bare path below.
  }

  return parseNetworkedPath(pathname)
}

function buildOpenSeaUrl(parsed: ParsedArtwork): string {
  const origin = parsed.testnet
    ? `https://${OPENSEA_TESTNET_HOST}`
    : `https://${OPENSEA_HOST}`
  const chain = parsed.chain || 'ethereum'
  return `${origin}/item/${chain}/${parsed.contract}/${parsed.tokenId}`
}

function buildArtBlocksUrl(parsed: ParsedArtwork): string {
  const chain = parsed.chain || '1'
  return `${ARTBLOCKS_ORIGIN}/token/${chain}/${parsed.contract}/${parsed.tokenId}`
}

function buildTransientUrl(parsed: ParsedArtwork): string {
  const chain = parsed.chain || 'ethereum'
  return `${TRANSIENT_ORIGIN}/nfts/${chain}/${parsed.contract}/${parsed.tokenId}`
}

export function isNetworkedArtUrl(value: string): boolean {
  return parseArtworkInput(value)?.source === 'networked'
}

export function isOpenSeaArtworkUrl(value: string): boolean {
  return parseArtworkInput(value)?.source === 'opensea'
}

export function isArtBlocksArtworkUrl(value: string): boolean {
  return parseArtworkInput(value)?.source === 'artblocks'
}

export function isTransientArtworkUrl(value: string): boolean {
  return parseArtworkInput(value)?.source === 'transient'
}

/**
 * Full embed URL: Networked.art with artist slug, or a marketplace token URL.
 * Bare `0x…/id` paths are not enough to rebuild a working page.
 */
export function isCompleteArtworkUrl(value: string): boolean {
  const parsed = parseArtworkInput(value)
  if (!parsed) {
    return false
  }
  return parsed.source !== 'networked' || Boolean(parsed.artist)
}

/**
 * Onchain / composer path: `{0xcontract}/{tokenId}` (artist slug omitted).
 * Accepts Networked.art, OpenSea, Art Blocks, Transient, `{artist}/0x…/id`, or bare `0x…/id`.
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
 * in the input (needed for page fetch / OG preview). Marketplace URLs return
 * null — use `normalizeArtworkUrl` to keep the original platform link.
 */
export function buildNetworkedArtUrl(path: string): string | null {
  const parsed = parseArtworkInput(path)
  if (!parsed || parsed.source !== 'networked') {
    return null
  }
  if (parsed.artist) {
    return `${NETWORKED_ORIGIN}/${parsed.artist}/${parsed.contract}/${parsed.tokenId}`
  }
  return `${NETWORKED_ORIGIN}/${parsed.contract}/${parsed.tokenId}`
}

/** Canonical embed URL: keep each platform's own token page. */
export function normalizeArtworkUrl(value: string): string | null {
  const parsed = parseArtworkInput(value)
  if (!parsed) {
    return null
  }
  if (parsed.source === 'opensea') {
    return buildOpenSeaUrl(parsed)
  }
  if (parsed.source === 'artblocks') {
    return buildArtBlocksUrl(parsed)
  }
  if (parsed.source === 'transient') {
    return buildTransientUrl(parsed)
  }
  return buildNetworkedArtUrl(value)
}

export function normalizeNetworkedArtUrl(value: string): string | null {
  return normalizeArtworkUrl(value)
}

/** OpenSea's public metadata API (no key) — actual artwork image, not the OG card. */
export function buildOpenSeaMetadataApiUrl(value: string): string | null {
  const parsed = parseArtworkInput(value)
  if (!parsed || parsed.source !== 'opensea') {
    return null
  }
  const chain = parsed.chain || 'ethereum'
  const origin = parsed.testnet
    ? 'https://testnets-api.opensea.io'
    : 'https://api.opensea.io'
  return `${origin}/api/v2/metadata/${chain}/${parsed.contract}/${parsed.tokenId}`
}

/** Art Blocks token metadata API — name, artist, and static PNG. */
export function buildArtBlocksTokenApiUrl(value: string): string | null {
  const parsed = parseArtworkInput(value)
  if (!parsed || parsed.source !== 'artblocks') {
    return null
  }
  const chain = parsed.chain || '1'
  return `${ARTBLOCKS_TOKEN_API_ORIGIN}/${chain}/${parsed.contract}/${parsed.tokenId}`
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

/** OpenSea page OG tags point at a branded `/opengraph-image` card, not the NFT. */
export function isGenericOpenSeaOgImage(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl)
    const host = url.hostname.replace(/^www\./, '')
    if (!OPENSEA_HOSTS.has(host)) {
      return false
    }
    return /\/opengraph-image$/i.test(url.pathname.replace(/\/+$/, ''))
  } catch {
    return false
  }
}

/** Transient page OG tags point at a branded `/og-image` card, not the NFT. */
export function isGenericTransientOgImage(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl)
    const host = url.hostname.replace(/^www\./, '')
    if (host !== TRANSIENT_HOST) {
      return false
    }
    return /\/og-image$/i.test(url.pathname.replace(/\/+$/, ''))
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

export function isGenericArtBlocksTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) {
    return true
  }
  const normalized = title.trim().toLowerCase()
  return normalized === 'art blocks' || normalized === 'artblocks'
}

export function isGenericTransientTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) {
    return true
  }
  const normalized = title.trim().toLowerCase()
  return (
    normalized === 'transient' ||
    normalized === 'transient labs' ||
    normalized === 'transient.xyz'
  )
}

/** Prefer the page's CDN/IPFS artwork when OG tags are the site default. */
export function extractArtworkImageFromHtml(html: string): string | null {
  const transientCdns = html.match(
    /https:\/\/img\.transient\.xyz\/\?[^"'\s<>]+/gi,
  )
  const artworkCdn = transientCdns?.find((candidate) => {
    const decoded = decodeHtmlEntities(candidate)
    return (
      !/\/pfps\//i.test(decoded) &&
      !/%2Fpfps%2F/i.test(decoded) &&
      !decoded.endsWith(')')
    )
  })
  if (artworkCdn) {
    return cleanTransientCdnUrl(decodeHtmlEntities(artworkCdn))
  }

  const transientImageUri = html.match(/"imageUri":"(https:[^"]+)"/)
  if (transientImageUri?.[1]) {
    return buildTransientPreviewImage(decodeHtmlEntities(transientImageUri[1]))
  }

  const transientIpfs = html.match(
    /https:\/\/ipfs\.transientusercontent\.xyz\/ipfs\/[A-Za-z0-9]+\/media/i,
  )
  if (transientIpfs?.[0]) {
    return buildTransientPreviewImage(transientIpfs[0])
  }

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

function buildTransientPreviewImage(sourceUrl: string): string {
  if (/^https:\/\/img\.transient\.xyz\//i.test(sourceUrl)) {
    return cleanTransientCdnUrl(sourceUrl)
  }
  return `${TRANSIENT_IMAGE_ORIGIN}/?output=webp&url=${encodeURIComponent(sourceUrl)}&w=640`
}

function cleanTransientCdnUrl(imageUrl: string): string {
  try {
    const parsed = new URL(imageUrl)
    if (parsed.searchParams.get('we') === '') {
      parsed.searchParams.delete('we')
    }
    return parsed.toString()
  } catch {
    return imageUrl
  }
}

/** Transient CDN blocks some browser hotlinks; load those through our proxy. */
export function artworkDisplayUrl(imageUrl: string): string {
  if (imageUrl.startsWith('/api/preview?imageSrc=')) {
    return imageUrl
  }
  if (!isProxyableArtworkImageUrl(imageUrl)) {
    return imageUrl
  }
  return `/api/preview?imageSrc=${encodeURIComponent(imageUrl)}`
}

export function isProxyableArtworkImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') {
      return false
    }
    const host = url.hostname.replace(/^www\./, '')
    return TRANSIENT_PROXY_HOSTS.has(host)
  } catch {
    return false
  }
}

export function resolveArtworkImageFromHtml(html: string): string | null {
  const ogImage =
    extractMetaContent(html, 'og:image') ||
    extractMetaContent(html, 'twitter:image')
  if (ogImage) {
    const unwrapped = unwrapNetworkedOgImage(ogImage)
    if (
      !isGenericNetworkedOgImage(ogImage) &&
      !isGenericNetworkedOgImage(unwrapped) &&
      !isGenericOpenSeaOgImage(ogImage) &&
      !isGenericOpenSeaOgImage(unwrapped) &&
      !isGenericTransientOgImage(ogImage) &&
      !isGenericTransientOgImage(unwrapped)
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
  if (
    ogTitle &&
    !isGenericNetworkedTitle(ogTitle) &&
    !isGenericArtBlocksTitle(ogTitle) &&
    !isGenericTransientTitle(ogTitle)
  ) {
    return ogTitle
  }
  return null
}

/**
 * Networked.art packs title + artist into one string, e.g.
 * "everyone who was there by INFINITEYAY"
 * OpenSea uses "DOOM SCROLL #12 - Doom Scroll | OpenSea" — the middle
 * segment is the collection name, not the artist.
 * Art Blocks uses "DDUST #342 by jiwa | Art Blocks".
 * Transient uses "Dust by @Monk | Transient Labs".
 */
export function parseArtworkTitle(ogTitle: string | null | undefined): {
  title: string | null
  artist: string | null
} {
  if (!ogTitle?.trim()) {
    return { title: null, artist: null }
  }

  let trimmed = ogTitle.trim()
  const artBlocks = trimmed.match(/^(.+?)\s+\|\s+Art Blocks$/i)
  if (artBlocks?.[1]) {
    trimmed = artBlocks[1].trim()
  }

  const transient = trimmed.match(/^(.+?)\s+\|\s+Transient Labs$/i)
  if (transient?.[1]) {
    trimmed = transient[1].trim()
  }

  const openSea = trimmed.match(/^(.+?)\s+-\s+.+?\s+\|\s+OpenSea$/i)
  if (openSea?.[1]) {
    return {
      title: openSea[1].trim(),
      artist: null,
    }
  }

  const match = trimmed.match(/^(.+?)\s+by\s+(.+)$/i)
  if (!match?.[1] || !match[2]) {
    return { title: trimmed, artist: null }
  }

  return {
    title: match[1].trim(),
    artist: match[2].trim().replace(/^@/, ''),
  }
}

/**
 * OpenSea item pages embed the collection owner (the artist) in page JSON
 * as Collection.owner.displayName — not the token holder.
 */
export function extractOpenSeaArtistFromHtml(html: string): string | null {
  const match = html.match(
    /"__typename":"Collection","owner":\{"displayName":"([^"]+)"/,
  )
  const name = match?.[1]?.trim()
  return name ? decodeHtmlEntities(name) : null
}

/**
 * Transient token pages embed the creator as username/displayName in the
 * RSC payload, and as a UserName node in the HTML.
 */
export function extractTransientArtistFromHtml(html: string): string | null {
  const json = html.match(/"username":"([^"]+)","displayName":"([^"]+)"/)
  const fromJson = json?.[2]?.trim() || json?.[1]?.trim()
  if (fromJson) {
    return decodeHtmlEntities(fromJson).replace(/^@/, '')
  }

  const fromDom = html.match(/UserName-module_root[^>]*>\s*([^<]+)/)
  const name = fromDom?.[1]?.trim()
  return name ? decodeHtmlEntities(name).replace(/^@/, '') : null
}

/** Collection slug from OpenSea's embedded item payload. */
export function extractOpenSeaCollectionSlugFromHtml(html: string): string | null {
  const match = html.match(/"slug":"([a-z0-9-]+)","isPlaceholderCollection"/)
  return match?.[1] ?? null
}

export function buildOpenSeaCollectionApiUrl(
  slug: string,
  artworkUrl?: string,
): string | null {
  if (!slug.trim()) {
    return null
  }
  const parsed = artworkUrl ? parseArtworkInput(artworkUrl) : null
  const origin = parsed?.testnet
    ? 'https://testnets-api.opensea.io'
    : 'https://api.opensea.io'
  return `${origin}/api/v2/collections/${encodeURIComponent(slug)}`
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

/** Parse `594x1056` / `594×1056` from token metadata `media.dimensions`. */
export function parseDimensionString(
  value: string | null | undefined,
): { width: number; height: number } | null {
  if (!value?.trim()) {
    return null
  }
  const match = value.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i)
  if (!match?.[1] || !match[2]) {
    return null
  }
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return { width, height }
}

/** Transient (and similar) pages embed `"dimensions":"720x1280"` in page JSON. */
export function extractArtworkDimensionsFromHtml(
  html: string,
): { width: number; height: number } | null {
  const match = html.match(/dimensions\\?":\\?"(\d+\s*[x×]\s*\d+)/i)
  return parseDimensionString(match?.[1])
}
