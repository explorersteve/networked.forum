import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Catch missed posts if the client or Alchemy webhook fails. New posts are
// indexed by the webhook / submitting tab; this is a slow backstop. Each run
// walks missed blocks in FORUM_LOG_RANGE chunks (Alchemy free-tier getLogs cap).
crons.interval(
  'sync forum posts from chain',
  { minutes: 30 },
  internal.postsActions.syncFromChain,
  {},
)

export default crons
