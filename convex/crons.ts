import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Catch missed posts if the client or Alchemy webhook fails. The window is
// clamped to FORUM_LOG_RANGE (Alchemy free tier allows a 10 block eth_getLogs
// span); 9 blocks per 30s still outruns mainnet's ~2.5 blocks per 30s.
crons.interval(
  'sync forum posts from chain',
  { seconds: 30 },
  internal.postsActions.syncFromChain,
  {},
)

export default crons
