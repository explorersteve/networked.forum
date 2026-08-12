import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'

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
    /** Full Networked.art URL with artist slug (onchain path omits it). */
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
