import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import {
  extractNetworkedArtPath,
  isCompleteArtworkUrl,
  normalizeArtworkUrl,
} from './lib/networkedArt'

const postReturn = v.object({
  _id: v.id('posts'),
  _creationTime: v.number(),
  txHash: v.string(),
  author: v.string(),
  timestamp: v.number(),
  url: v.string(),
  title: v.string(),
  artist: v.string(),
  text: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  blockNumber: v.number(),
})

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(postReturn),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 48, 1), 100)
    return await ctx.db
      .query('posts')
      .withIndex('by_timestamp')
      .order('desc')
      .take(limit)
  },
})

export const getByTx = query({
  args: {
    txHash: v.string(),
  },
  returns: v.union(postReturn, v.null()),
  handler: async (ctx, args) => {
    const txHash = args.txHash.toLowerCase()
    return await ctx.db
      .query('posts')
      .withIndex('by_txHash', (q) => q.eq('txHash', txHash))
      .unique()
  },
})

export const getByTxInternal = internalQuery({
  args: {
    txHash: v.string(),
  },
  returns: v.union(postReturn, v.null()),
  handler: async (ctx, args) => {
    const txHash = args.txHash.toLowerCase()
    return await ctx.db
      .query('posts')
      .withIndex('by_txHash', (q) => q.eq('txHash', txHash))
      .unique()
  },
})

export const upsert = internalMutation({
  args: {
    txHash: v.string(),
    author: v.string(),
    timestamp: v.number(),
    url: v.string(),
    title: v.string(),
    artist: v.string(),
    text: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    blockNumber: v.number(),
  },
  returns: v.id('posts'),
  handler: async (ctx, args) => {
    const txHash = args.txHash.toLowerCase()
    const existing = await ctx.db
      .query('posts')
      .withIndex('by_txHash', (q) => q.eq('txHash', txHash))
      .unique()

    const values = {
      txHash,
      author: args.author.toLowerCase(),
      timestamp: args.timestamp,
      url: args.url,
      title: args.title,
      artist: args.artist,
      text: args.text,
      imageUrl: args.imageUrl,
      blockNumber: args.blockNumber,
    }

    if (existing) {
      // Never wipe richer metadata with empty strings from a later core upsert.
      await ctx.db.patch(existing._id, {
        author: values.author,
        timestamp: values.timestamp,
        url: values.url,
        text: values.text,
        blockNumber: values.blockNumber,
        title: values.title || existing.title,
        artist: values.artist || existing.artist,
        imageUrl: values.imageUrl || existing.imageUrl,
      })
      return existing._id
    }

    return await ctx.db.insert('posts', values)
  },
})

export const patchMetadata = internalMutation({
  args: {
    txHash: v.string(),
    title: v.string(),
    artist: v.string(),
    imageUrl: v.optional(v.string()),
  },
  returns: v.union(v.id('posts'), v.null()),
  handler: async (ctx, args) => {
    const txHash = args.txHash.toLowerCase()
    const existing = await ctx.db
      .query('posts')
      .withIndex('by_txHash', (q) => q.eq('txHash', txHash))
      .unique()

    if (!existing) {
      return null
    }

    await ctx.db.patch(existing._id, {
      title: args.title || existing.title,
      artist: args.artist || existing.artist,
      imageUrl: args.imageUrl || existing.imageUrl,
    })
    return existing._id
  },
})

/**
 * Client-facing: remember the full artwork URL for an onchain path. Called when
 * a post is submitted, so indexing can rebuild the embed link even if the
 * browser never reports back (closed tab, failed request, webhook / cron).
 * Stores Networked.art URLs with an artist slug, and OpenSea item URLs.
 */
export const rememberArtworkUrl = mutation({
  args: {
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const url = normalizeArtworkUrl(args.url)
    const path = url ? extractNetworkedArtPath(url) : null
    if (!url || !path) {
      throw new Error('Invalid artwork URL')
    }

    // A bare Networked path carries no slug, so it would be a useless lookup.
    if (!isCompleteArtworkUrl(url)) {
      return null
    }

    const existing = await ctx.db
      .query('artworkUrls')
      .withIndex('by_path', (q) => q.eq('path', path))
      .unique()

    if (existing) {
      if (existing.url !== url) {
        await ctx.db.patch(existing._id, { url })
      }
      return null
    }

    await ctx.db.insert('artworkUrls', { path, url })
    return null
  },
})

export const getArtworkUrl = internalQuery({
  args: {
    path: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('artworkUrls')
      .withIndex('by_path', (q) => q.eq('path', args.path))
      .unique()
    return row?.url ?? null
  },
})

export const getIndexerCursor = internalQuery({
  args: {},
  returns: v.union(v.number(), v.null()),
  handler: async (ctx) => {
    const row = await ctx.db
      .query('indexerState')
      .withIndex('by_key', (q) => q.eq('key', 'payloadSet'))
      .unique()
    return row?.lastBlock ?? null
  },
})

export const setIndexerCursor = internalMutation({
  args: {
    lastBlock: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('indexerState')
      .withIndex('by_key', (q) => q.eq('key', 'payloadSet'))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, { lastBlock: args.lastBlock })
    } else {
      await ctx.db.insert('indexerState', {
        key: 'payloadSet',
        lastBlock: args.lastBlock,
      })
    }
    return null
  },
})

/** Client-facing helper: schedule indexing after a confirmed post. */
export const requestIndex = mutation({
  args: {
    txHash: v.string(),
    titleHint: v.optional(v.string()),
    artistHint: v.optional(v.string()),
    imageUrlHint: v.optional(v.string()),
    /** Full artwork URL (Networked slug or OpenSea). Onchain path omits it. */
    urlHint: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!/^0x[a-fA-F0-9]{64}$/.test(args.txHash)) {
      throw new Error('Invalid transaction hash')
    }

    await ctx.scheduler.runAfter(0, internal.postsActions.indexFromTx, {
      txHash: args.txHash,
      titleHint: args.titleHint,
      artistHint: args.artistHint,
      imageUrlHint: args.imageUrlHint,
      urlHint: args.urlHint,
    })
    return null
  },
})
