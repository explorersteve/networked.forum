'use node'

import { v } from 'convex/values'
import { parseAbiItem, type Hex } from 'viem'
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
  extractMetaContent,
  parseArtworkTitle,
  unwrapNetworkedOgImage,
} from './lib/networkedArt'

const payloadSetEvent = parseAbiItem(
  'event PayloadSet(uint256 _tokenId, uint256 _length)',
)

async function fetchArtworkMetadata(url: string): Promise<{
  title: string
  artist: string
  imageUrl?: string
}> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'ForumIndexer/1.0',
      },
    })
    if (!response.ok) {
      return { title: '', artist: '' }
    }

    const html = await response.text()
    const ogTitle =
      extractMetaContent(html, 'og:title') ||
      extractMetaContent(html, 'twitter:title')
    const ogImage = extractMetaContent(html, 'og:image')
    const parsed = parseArtworkTitle(ogTitle)

    return {
      title: parsed.title ?? '',
      artist: parsed.artist ?? '',
      imageUrl: ogImage ? unwrapNetworkedOgImage(ogImage) : undefined,
    }
  } catch (error) {
    console.error('Failed to fetch artwork metadata', error)
    return { title: '', artist: '' }
  }
}

type IndexArgs = {
  txHash: string
  titleHint?: string
  artistHint?: string
  imageUrlHint?: string
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
    return { indexed: false, reason: 'Not an OpenVault transaction' }
  }

  const entry = decodeOpenVaultEntry(tx.input)
  if (!entry) {
    return { indexed: false, reason: 'Could not decode setEntryPublic' }
  }

  const parsed = parseForumPayload(entry)
  if (!parsed) {
    return { indexed: false, reason: 'Not a forum artwork payload' }
  }

  const receipt = await client.getTransactionReceipt({ hash: txHash })
  const blockNumber = receipt.blockNumber ?? tx.blockNumber
  if (blockNumber == null) {
    return { indexed: false, reason: 'Missing block number' }
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

  await ctx.runMutation(internal.posts.upsert, {
    txHash,
    author: tx.from,
    timestamp,
    url: parsed.url,
    title,
    artist,
    text: parsed.text,
    imageUrl,
    blockNumber: Number(blockNumber),
  })

  const needsEnrich = !title || !artist || !imageUrl
  if (needsEnrich) {
    await ctx.scheduler.runAfter(0, internal.postsActions.enrichMetadata, {
      txHash,
      url: parsed.url,
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
    if (!meta.title && !meta.artist && !meta.imageUrl) {
      return null
    }

    await ctx.runMutation(internal.posts.patchMetadata, {
      txHash: args.txHash,
      title: meta.title,
      artist: meta.artist,
      imageUrl: meta.imageUrl,
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
