import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import {
  parseArtworkRef,
  normalizeArtworkUrl,
  isOpenSeaArtworkUrl,
  isArtBlocksArtworkUrl,
  isTransientArtworkUrl,
  isProxyableArtworkImageUrl,
  buildOpenSeaMetadataApiUrl,
  buildOpenSeaCollectionApiUrl,
  buildArtBlocksTokenApiUrl,
  extractOpenSeaArtistFromHtml,
  extractOpenSeaCollectionSlugFromHtml,
  extractTransientArtistFromHtml,
  extractArtworkDimensionsFromHtml,
  parseArtworkTitle,
  parseDimensionString,
  resolveArtworkImageFromHtml,
  resolveArtworkTitleFromHtml,
} from '~/utils/networkedArt'

type PreviewResult = {
  url: string
  title: string | null
  artist: string | null
  image: string | null
  width: number | null
  height: number | null
}

const cache = new Map<string, { expiresAt: number; value: PreviewResult }>()
const CACHE_TTL_MS = 10 * 60_000
const erc721MetadataAbi = parseAbi([
  'function tokenURI(uint256 tokenId) view returns (string)',
])
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/'
const PREVIEW_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

function firstRpcUrl(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) {
        return item.trim()
      }
    }
    return null
  }
  if (typeof value !== 'string') {
    return null
  }
  const first = value.split(',')[0]?.trim()
  return first || null
}

function resolveTokenUri(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `${IPFS_GATEWAY}${uri.slice('ipfs://'.length).replace(/^ipfs\//, '')}`
  }
  return uri
}

async function fetchOnchainPreview(url: string): Promise<{
  title: string | null
  image: string | null
  width: number | null
  height: number | null
}> {
  const ref = parseArtworkRef(url)
  if (!ref) {
    return { title: null, image: null, width: null, height: null }
  }

  const config = useRuntimeConfig()
  const chainKey = config.public.forum.chain === 'mainnet' ? 'mainnet' : 'sepolia'
  const rpcUrl = firstRpcUrl(config.public.evm?.chains?.[chainKey]?.rpcs)
  if (!rpcUrl) {
    return { title: null, image: null }
  }

  try {
    const client = createPublicClient({
      chain: chainKey === 'mainnet' ? mainnet : sepolia,
      transport: http(rpcUrl),
    })
    const tokenUri = await client.readContract({
      address: ref.contract,
      abi: erc721MetadataAbi,
      functionName: 'tokenURI',
      args: [ref.tokenId],
    })

    let json: string
    const dataPrefix = 'data:application/json;base64,'
    if (tokenUri.startsWith(dataPrefix)) {
      json = Buffer.from(tokenUri.slice(dataPrefix.length), 'base64').toString(
        'utf8',
      )
    } else if (tokenUri.startsWith('data:application/json,')) {
      json = decodeURIComponent(tokenUri.slice('data:application/json,'.length))
    } else {
      const response = await fetch(resolveTokenUri(tokenUri), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) {
        return { title: null, image: null, width: null, height: null }
      }
      json = await response.text()
    }

    const metadata = JSON.parse(json) as {
      name?: string
      image?: string
      media?: { dimensions?: string }
    }
    const dimensions = parseDimensionString(metadata.media?.dimensions)
    return {
      title: typeof metadata.name === 'string' ? metadata.name : null,
      image:
        typeof metadata.image === 'string' && metadata.image
          ? resolveTokenUri(metadata.image)
          : null,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    }
  } catch (error) {
    console.error('Failed to read onchain token metadata', error)
    return { title: null, image: null, width: null, height: null }
  }
}

async function fetchOpenSeaCollectionArtist(
  url: string,
  html: string,
): Promise<string | null> {
  const fromHtml = extractOpenSeaArtistFromHtml(html)
  if (fromHtml) {
    return fromHtml
  }

  const slug = extractOpenSeaCollectionSlugFromHtml(html)
  const collectionUrl = slug ? buildOpenSeaCollectionApiUrl(slug, url) : null
  if (!collectionUrl) {
    return null
  }

  try {
    const response = await fetch(collectionUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) {
      return null
    }
    const collection = (await response.json()) as { twitter_username?: string }
    const handle =
      typeof collection.twitter_username === 'string'
        ? collection.twitter_username.trim()
        : ''
    return handle || null
  } catch (error) {
    console.error('Failed to fetch OpenSea collection artist', error)
    return null
  }
}

async function fetchOpenSeaPreview(url: string): Promise<{
  title: string | null
  image: string | null
}> {
  const metadataUrl = buildOpenSeaMetadataApiUrl(url)
  if (!metadataUrl) {
    return { title: null, image: null }
  }

  try {
    const response = await fetch(metadataUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) {
      return { title: null, image: null }
    }

    const metadata = (await response.json()) as {
      name?: string
      image?: string
    }
    return {
      title: typeof metadata.name === 'string' ? metadata.name : null,
      image:
        typeof metadata.image === 'string' && metadata.image
          ? resolveTokenUri(metadata.image)
          : null,
    }
  } catch (error) {
    console.error('Failed to fetch OpenSea metadata', error)
    return { title: null, image: null }
  }
}

async function fetchArtBlocksPreview(url: string): Promise<{
  title: string | null
  artist: string | null
  image: string | null
  width: number | null
  height: number | null
}> {
  const metadataUrl = buildArtBlocksTokenApiUrl(url)
  const empty = {
    title: null,
    artist: null,
    image: null,
    width: null,
    height: null,
  }
  if (!metadataUrl) {
    return empty
  }

  try {
    const response = await fetch(metadataUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) {
      return empty
    }

    const metadata = (await response.json()) as {
      name?: string
      artist?: string
      collection_name?: string
      image?: string
      aspect_ratio?: number
    }
    const collection = parseArtworkTitle(
      typeof metadata.collection_name === 'string'
        ? metadata.collection_name
        : null,
    )
    const artistFromField =
      typeof metadata.artist === 'string' ? metadata.artist.trim() : ''
    const aspectRatio =
      typeof metadata.aspect_ratio === 'number' &&
      Number.isFinite(metadata.aspect_ratio) &&
      metadata.aspect_ratio > 0
        ? metadata.aspect_ratio
        : null
    return {
      title:
        collection.title ||
        (typeof metadata.name === 'string' ? metadata.name : null),
      artist: artistFromField || collection.artist,
      image:
        typeof metadata.image === 'string' && metadata.image
          ? resolveTokenUri(metadata.image)
          : null,
      width: aspectRatio ? Math.round(aspectRatio * 1000) : null,
      height: aspectRatio ? 1000 : null,
    }
  } catch (error) {
    console.error('Failed to fetch Art Blocks metadata', error)
    return empty
  }
}

async function proxyArtworkImage(event: Parameters<typeof getQuery>[0], src: string) {
  if (!isProxyableArtworkImageUrl(src)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a supported artwork image URL',
    })
  }

  try {
    const response = await fetch(src, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': PREVIEW_UA,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    })
    if (!response.ok) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Failed to fetch artwork image',
      })
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Artwork media is not an image',
      })
    }

    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Cache-Control', 'public, max-age=86400, immutable')
    return Buffer.from(await response.arrayBuffer())
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('Failed to proxy artwork image', error)
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to fetch artwork image',
    })
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const imageSrc = typeof query.imageSrc === 'string' ? query.imageSrc : ''
  if (imageSrc) {
    return await proxyArtworkImage(event, imageSrc)
  }

  const rawUrl = typeof query.url === 'string' ? query.url : ''
  const url = normalizeArtworkUrl(rawUrl)

  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a valid artwork URL',
    })
  }

  const cached = cache.get(url)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  let title: string | null = null
  let artist: string | null = null
  let image: string | null = null
  let width: number | null = null
  let height: number | null = null
  let pageHtml = ''

  if (isArtBlocksArtworkUrl(url)) {
    const artblocks = await fetchArtBlocksPreview(url)
    title = artblocks.title
    artist = artblocks.artist
    image = artblocks.image
    width = artblocks.width
    height = artblocks.height
  }

  if (!isArtBlocksArtworkUrl(url) || !title || !artist || !image) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': PREVIEW_UA,
        },
        signal: AbortSignal.timeout(8_000),
      })
      if (response.ok) {
        pageHtml = await response.text()
        title = title || resolveArtworkTitleFromHtml(pageHtml)
        image = image || resolveArtworkImageFromHtml(pageHtml)
      }
    } catch (error) {
      console.error('Failed to fetch artwork page', error)
    }

    const parsedTitle = parseArtworkTitle(title)
    title = parsedTitle.title || title
    artist = artist || parsedTitle.artist
    if (isOpenSeaArtworkUrl(url) && pageHtml) {
      artist = (await fetchOpenSeaCollectionArtist(url, pageHtml)) || artist
    }
    if (isTransientArtworkUrl(url) && pageHtml) {
      artist = artist || extractTransientArtistFromHtml(pageHtml)
      const dims = extractArtworkDimensionsFromHtml(pageHtml)
      width = width ?? dims?.width ?? null
      height = height ?? dims?.height ?? null
    }
  }

  // Marketplace thumbs are often square crops. On-chain `image` +
  // `media.dimensions` are the work's real frame — prefer those for OpenSea.
  if (isOpenSeaArtworkUrl(url) || !title || !image) {
    const onchain = await fetchOnchainPreview(url)
    title = title || onchain.title
    if (isOpenSeaArtworkUrl(url)) {
      image = onchain.image || image
    } else {
      image = image || onchain.image
    }
    width = onchain.width
    height = onchain.height
  }

  if (isOpenSeaArtworkUrl(url) && (!title || !image)) {
    const opensea = await fetchOpenSeaPreview(url)
    title = title || opensea.title
    image = image || opensea.image
  }

  if (!image) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to fetch artwork preview',
    })
  }

  const result: PreviewResult = { url, title, artist, image, width, height }
  cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, value: result })
  return result
})
