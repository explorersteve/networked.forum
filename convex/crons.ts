import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Catch missed posts if the client or Alchemy webhook fails.
crons.interval(
  'sync forum posts from chain',
  { seconds: 30 },
  internal.postsActions.syncFromChain,
  { maxBlocks: 2_000 },
)

export default crons
