import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import {
  parseArtworkRef,
  normalizeNetworkedArtUrl,
  resolveArtworkImageFromHtml,
  resolveArtworkTitleFromHtml,
} from '~/utils/networkedArt'

type PreviewResult = {
  url: string
  title: string | null
  image: string | null
}

const cache = new Map<string, { expiresAt: number; value: PreviewResult }>()
const CACHE_TTL_MS = 10 * 60_000
const erc721MetadataAbi = parseAbi([
  'function tokenURI(uint256 tokenId) view returns (string)',
])
const IPFS_GATEWAY = 'https://ipfs.networked.art/ipfs/'
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
}> {
  const ref = parseArtworkRef(url)
  if (!ref) {
    return { title: null, image: null }
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
        return { title: null, image: null }
      }
      json = await response.text()
    }

    const metadata = JSON.parse(json) as { name?: string; image?: string }
    return {
      title: typeof metadata.name === 'string' ? metadata.name : null,
      image:
        typeof metadata.image === 'string' && metadata.image
          ? resolveTokenUri(metadata.image)
          : null,
    }
  } catch (error) {
    console.error('Failed to read onchain token metadata', error)
    return { title: null, image: null }
  }
}

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

  let title: string | null = null
  let image: string | null = null

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': PREVIEW_UA,
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (response.ok) {
      const html = await response.text()
      title = resolveArtworkTitleFromHtml(html)
      image = resolveArtworkImageFromHtml(html)
    }
  } catch (error) {
    console.error('Failed to fetch artwork page', error)
  }

  if (!title || !image) {
    const onchain = await fetchOnchainPreview(url)
    title = title || onchain.title
    image = image || onchain.image
  }

  if (!image) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to fetch artwork preview',
    })
  }

  const result: PreviewResult = { url, title, image }
  cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, value: result })
  return result
})
