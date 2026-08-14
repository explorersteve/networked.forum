'use node'

import { v } from 'convex/values'
import { parseAbi, parseAbiItem, type Hex } from 'viem'
import { internal } from './_generated/api'
import { action, internalAction, type ActionCtx } from './_generated/server'
import { createForumClient, getForumConfig } from './lib/chain'
import {
  addressesEqual,
  decodeOpenVaultEntry,
  openVaultAbi,
  parseForumPayload,
} from './lib/forum'
import {
  buildArtBlocksTokenApiUrl,
  buildOpenSeaCollectionApiUrl,
  buildOpenSeaMetadataApiUrl,
  extractNetworkedArtPath,
  extractOpenSeaArtistFromHtml,
  extractOpenSeaCollectionSlugFromHtml,
  extractTransientArtistFromHtml,
  isArtBlocksArtworkUrl,
  isCompleteArtworkUrl,
  isOpenSeaArtworkUrl,
  isTransientArtworkUrl,
  normalizeArtworkUrl,
  parseArtworkRef,
  parseArtworkTitle,
  resolveArtworkImageFromHtml,
  resolveArtworkTitleFromHtml,
  toOriginalArtworkImageUrl,
} from './lib/networkedArt'

const payloadSetEvent = parseAbiItem(
  'event PayloadSet(uint256 _tokenId, uint256 _length)',
)

async function fetchArtworkMetadata(url: string): Promise<{
  title: string
  artist: string
  imageUrl?: string
}> {
  if (isArtBlocksArtworkUrl(url)) {
    const artblocks = await fetchArtBlocksMetadata(url)
    if (artblocks.title || artblocks.artist || artblocks.imageUrl) {
      return artblocks
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
    })
    if (!response.ok) {
      return { title: '', artist: '' }
    }

    const html = await response.text()
    const ogTitle = resolveArtworkTitleFromHtml(html)
    const imageUrl = resolveArtworkImageFromHtml(html)
    const parsed = parseArtworkTitle(ogTitle)
    const openSeaArtist = isOpenSeaArtworkUrl(url)
      ? await resolveOpenSeaArtist(url, html)
      : null
    const transientArtist = isTransientArtworkUrl(url)
      ? extractTransientArtistFromHtml(html)
      : null

    return {
      title: parsed.title ?? '',
      artist: openSeaArtist || transientArtist || parsed.artist || '',
      imageUrl: imageUrl ?? undefined,
    }
  } catch (error) {
    console.error('Failed to fetch artwork metadata', error)
    return { title: '', artist: '' }
  }
}

async function resolveOpenSeaArtist(
  url: string,
  html: string,
): Promise<string> {
  const fromHtml = extractOpenSeaArtistFromHtml(html)
  if (fromHtml) {
    return fromHtml
  }

  const slug = extractOpenSeaCollectionSlugFromHtml(html)
  const collectionUrl = slug ? buildOpenSeaCollectionApiUrl(slug, url) : null
  if (!collectionUrl) {
    return ''
  }

  try {
    const response = await fetch(collectionUrl, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      return ''
    }
    const collection = (await response.json()) as { twitter_username?: string }
    return typeof collection.twitter_username === 'string'
      ? collection.twitter_username.trim()
      : ''
  } catch (error) {
    console.error('Failed to fetch OpenSea collection artist', error)
    return ''
  }
}

async function fetchOpenSeaMetadata(url: string): Promise<{
  title: string
  imageUrl?: string
}> {
  const metadataUrl = buildOpenSeaMetadataApiUrl(url)
  if (!metadataUrl) {
    return { title: '' }
  }

  try {
    const response = await fetch(metadataUrl, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      return { title: '' }
    }

    const metadata = (await response.json()) as {
      name?: string
      image?: string
    }
    return {
      title: typeof metadata.name === 'string' ? metadata.name : '',
      imageUrl:
        typeof metadata.image === 'string' && metadata.image
          ? toOriginalArtworkImageUrl(resolveTokenUri(metadata.image))
          : undefined,
    }
  } catch (error) {
    console.error('Failed to fetch OpenSea metadata', error)
    return { title: '' }
  }
}

async function fetchArtBlocksMetadata(url: string): Promise<{
  title: string
  artist: string
  imageUrl?: string
}> {
  const metadataUrl = buildArtBlocksTokenApiUrl(url)
  if (!metadataUrl) {
    return { title: '', artist: '' }
  }

  try {
    const response = await fetch(metadataUrl, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      return { title: '', artist: '' }
    }

    const metadata = (await response.json()) as {
      name?: string
      artist?: string
      collection_name?: string
      image?: string
    }
    const collection = parseArtworkTitle(
      typeof metadata.collection_name === 'string'
        ? metadata.collection_name
        : null,
    )
    const artistFromField =
      typeof metadata.artist === 'string' ? metadata.artist.trim() : ''
    return {
      title:
        collection.title ||
        (typeof metadata.name === 'string' ? metadata.name : ''),
      artist: artistFromField || collection.artist || '',
      imageUrl:
        typeof metadata.image === 'string' && metadata.image
          ? resolveTokenUri(metadata.image)
          : undefined,
    }
  } catch (error) {
    console.error('Failed to fetch Art Blocks metadata', error)
    return { title: '', artist: '' }
  }
}

const erc721MetadataAbi = parseAbi([
  'function tokenURI(uint256 tokenId) view returns (string)',
])

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/'

function resolveTokenUri(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `${IPFS_GATEWAY}${uri.slice('ipfs://'.length).replace(/^ipfs\//, '')}`
  }
  return uri
}

/**
 * Networked.art is the nicer source (CDN images), but it is reachable only
 * with the artist slug. The token's own metadata always works, so fall back to
 * it rather than leaving a post with a blank card.
 */
async function fetchOnchainMetadata(url: string): Promise<{
  title: string
  imageUrl?: string
}> {
  const ref = parseArtworkRef(url)
  if (!ref) {
    return { title: '' }
  }

  try {
    const client = createForumClient()
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
      json = decodeURIComponent(
        tokenUri.slice('data:application/json,'.length),
      )
    } else {
      const response = await fetch(resolveTokenUri(tokenUri), {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        return { title: '' }
      }
      json = await response.text()
    }

    const metadata = JSON.parse(json) as { name?: string; image?: string }
    return {
      title: typeof metadata.name === 'string' ? metadata.name : '',
      imageUrl:
        typeof metadata.image === 'string' && metadata.image
          ? resolveTokenUri(metadata.image)
          : undefined,
    }
  } catch (error) {
    console.error('Failed to read onchain token metadata', error)
    return { title: '' }
  }
}

type IndexArgs = {
  txHash: string
  titleHint?: string
  artistHint?: string
  imageUrlHint?: string
  /** Full artwork URL (Networked slug or marketplace). Onchain path omits it. */
  urlHint?: string
}

/** Prefer a client urlHint / existing full URL when it matches the onchain contract/token. */
function resolvePostUrl(
  parsedPath: string,
  parsedUrl: string,
  options?: { urlHint?: string; existingUrl?: string; storedUrl?: string },
): string {
  const candidates = [
    options?.urlHint,
    options?.existingUrl,
    options?.storedUrl,
    parsedUrl,
  ]
  let best = parsedUrl

  for (const candidate of candidates) {
    const normalized = candidate?.trim()
      ? normalizeArtworkUrl(candidate.trim())
      : null
    if (!normalized || extractNetworkedArtPath(normalized) !== parsedPath) {
      continue
    }
    best = normalized
    // Marketplace token URLs and Networked artist-slug URLs win over bare paths.
    if (isCompleteArtworkUrl(normalized)) {
      return normalized
    }
  }

  return best
}

/**
 * Dropped transactions used to vanish without a trace, which made a payload
 * format change impossible to spot until someone reported a missing post.
 */
function reject(
  txHash: string,
  reason: string,
): { indexed: false; reason: string } {
  console.warn(`Skipped transaction ${txHash}: ${reason}`)
  return { indexed: false, reason }
}

async function indexTransaction(
  ctx: ActionCtx,
  args: IndexArgs,
): Promise<{ indexed: boolean; reason?: string }> {
  const config = getForumConfig()
  const client = createForumClient()
  const txHash = args.txHash.toLowerCase() as Hex

  const existing = await ctx.runQuery(internal.posts.getByTxInternal, {
    txHash,
  })

  const tx = await client.getTransaction({ hash: txHash })
  if (!tx?.to || !addressesEqual(tx.to, config.contractAddress)) {
    return reject(txHash, 'Not an OpenVault transaction')
  }

  const entry = decodeOpenVaultEntry(tx.input)
  if (!entry) {
    return reject(txHash, 'Could not decode setEntryPublic')
  }

  const parsed = parseForumPayload(entry)
  if (!parsed) {
    return reject(txHash, 'Not a forum artwork payload')
  }

  const receipt = await client.getTransactionReceipt({ hash: txHash })
  const blockNumber = receipt.blockNumber ?? tx.blockNumber
  if (blockNumber == null) {
    return reject(txHash, 'Missing block number')
  }

  const block = await client.getBlock({ blockNumber })
  const timestamp = Number(block.timestamp)

  const title = args.titleHint?.trim() || existing?.title || ''
  const artist =
    args.artistHint?.trim() ||
    existing?.artist ||
    parsed.artistSlug ||
    ''
  const imageUrl = args.imageUrlHint || existing?.imageUrl
  const storedUrl = await ctx.runQuery(internal.posts.getArtworkUrl, {
    path: parsed.path,
  })
  const url = resolvePostUrl(parsed.path, parsed.url, {
    urlHint: args.urlHint,
    existingUrl: existing?.url,
    storedUrl: storedUrl ?? undefined,
  })
  await ctx.runMutation(internal.posts.upsert, {
    txHash,
    author: tx.from,
    timestamp,
    url,
    title,
    artist,
    text: parsed.text,
    imageUrl,
    blockNumber: Number(blockNumber),
  })

  const needsEnrich =
    !title ||
    !artist ||
    !imageUrl ||
    isOpenSeaArtworkUrl(url) ||
    isArtBlocksArtworkUrl(url) ||
    isTransientArtworkUrl(url)
  if (needsEnrich) {
    await ctx.scheduler.runAfter(0, internal.postsActions.enrichMetadata, {
      txHash,
      url,
    })
  }

  return { indexed: true }
}

export const indexFromTx = internalAction({
  args: {
    txHash: v.string(),
    titleHint: v.optional(v.string()),
    artistHint: v.optional(v.string()),
    imageUrlHint: v.optional(v.string()),
    urlHint: v.optional(v.string()),
  },
  returns: v.object({
    indexed: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    return await indexTransaction(ctx, args)
  },
})

/** Public action so the client can also call directly with retries. */
export const indexFromTxPublic = action({
  args: {
    txHash: v.string(),
    titleHint: v.optional(v.string()),
    artistHint: v.optional(v.string()),
    imageUrlHint: v.optional(v.string()),
    urlHint: v.optional(v.string()),
  },
  returns: v.object({
    indexed: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!/^0x[a-fA-F0-9]{64}$/i.test(args.txHash)) {
      throw new Error('Invalid transaction hash')
    }
    return await indexTransaction(ctx, args)
  },
})

export const enrichMetadata = internalAction({
  args: {
    txHash: v.string(),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const meta = await fetchArtworkMetadata(args.url)
    const existing = await ctx.runQuery(internal.posts.getByTxInternal, {
      txHash: args.txHash,
    })

    let title = meta.title
    let artist = meta.artist
    let imageUrl = meta.imageUrl
    if (isOpenSeaArtworkUrl(args.url)) {
      const onchain = await fetchOnchainMetadata(args.url)
      title = title || onchain.title
      if (onchain.imageUrl) {
        imageUrl = toOriginalArtworkImageUrl(onchain.imageUrl)
      } else if (imageUrl) {
        imageUrl = toOriginalArtworkImageUrl(imageUrl)
      }
      if (!title || !imageUrl) {
        const opensea = await fetchOpenSeaMetadata(args.url)
        title = title || opensea.title
        imageUrl = imageUrl || opensea.imageUrl
      }
    } else if (isArtBlocksArtworkUrl(args.url)) {
      const artblocks = await fetchArtBlocksMetadata(args.url)
      title = artblocks.title || title
      artist = artblocks.artist || artist
      imageUrl = artblocks.imageUrl || imageUrl
    } else if (!(title || existing?.title) || !(imageUrl || existing?.imageUrl)) {
      const onchain = await fetchOnchainMetadata(args.url)
      title = title || onchain.title
      imageUrl = imageUrl || onchain.imageUrl
    }

    if (!title && !artist && !imageUrl) {
      return null
    }

    await ctx.runMutation(internal.posts.patchMetadata, {
      txHash: args.txHash,
      title,
      artist,
      imageUrl,
    })
    return null
  },
})

export const syncFromChain = internalAction({
  args: {
    maxBlocks: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    lastBlock: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ processed: number; lastBlock: number }> => {
    const config = getForumConfig()
    const client = createForumClient()
    const maxBlocks = Math.max(
      1,
      Math.min(args.maxBlocks ?? config.logRange, config.logRange),
    )

    const cursor: number | null = await ctx.runQuery(
      internal.posts.getIndexerCursor,
      {},
    )
    const latest = await client.getBlockNumber()
    const fromBlock = BigInt(
      Math.max(cursor != null ? cursor + 1 : config.startBlock, config.startBlock),
    )

    if (fromBlock > latest) {
      return { processed: 0, lastBlock: Number(latest) }
    }

    const spanEnd = fromBlock + BigInt(maxBlocks) - BigInt(1)
    const toBlock = spanEnd < latest ? spanEnd : latest

    const logs = await client.getLogs({
      address: config.vesselAddress,
      event: payloadSetEvent,
      fromBlock,
      toBlock,
    })

    // The Vessel is shared across many tokens; only OpenVault's token is ours.
    const vaultTokenNum = await client.readContract({
      address: config.contractAddress,
      abi: openVaultAbi,
      functionName: 'vaultTokenNum',
    })

    let processed = 0
    for (const log of logs) {
      if (!log.transactionHash || log.args._tokenId !== vaultTokenNum) {
        continue
      }

      const result = await indexTransaction(ctx, {
        txHash: log.transactionHash,
      })
      if (result.indexed) {
        processed += 1
      }
    }

    await ctx.runMutation(internal.posts.setIndexerCursor, {
      lastBlock: Number(toBlock),
    })

    return { processed, lastBlock: Number(toBlock) }
  },
})
