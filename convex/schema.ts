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

  indexerState: defineTable({
    key: v.string(),
    lastBlock: v.number(),
  }).index('by_key', ['key']),
})
