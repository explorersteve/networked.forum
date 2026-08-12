import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  posts: defineTable({
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
    .index('by_timestamp', ['timestamp'])
    .index('by_txHash', ['txHash']),

  /**
   * The onchain payload stores a bare `0xcontract/tokenId` path, but
   * Networked.art 404s without the artist slug. The slug only exists in the
   * composer, so capture it at submit time — webhook / cron indexing has no
   * other way to rebuild a working URL.
   */
  artworkUrls: defineTable({
    path: v.string(),
    url: v.string(),
  }).index('by_path', ['path']),

  indexerState: defineTable({
    key: v.string(),
    lastBlock: v.number(),
  }).index('by_key', ['key']),
})
