import {
  createIdbStore,
  createIndexer,
  type Indexer,
  type IndexerStatus,
} from '@1001-digital/simple-indexer'
import { createPublicClient, http, type Address } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { createSimulatedPost } from '~/utils/demoPosts'
import { forumAbi, isForumConfigured, type ForumPost } from '~/utils/forum'

const PAGE_SIZE = 12

const chainMap = {
  mainnet,
  sepolia,
} as const

type SupportedChain = keyof typeof chainMap

// Shared across pages so simulate/post on /post updates the home feed.
const posts = ref<ForumPost[]>([])
const visibleCount = ref(PAGE_SIZE)
const status = ref<IndexerStatus | null>(null)
const ready = ref(false)
const error = ref<string | null>(null)

let indexer: Indexer | null = null
let unsubStatus: (() => void) | null = null
let unsubChange: (() => void) | null = null
let simulateCount = 0
let bootstrapped = false
let startPromise: Promise<void> | null = null

function toForumPost(row: Record<string, unknown>): ForumPost | null {
  const id = typeof row.id === 'string' ? row.id : null
  const author = typeof row.author === 'string' ? (row.author as Address) : null
  const url = typeof row.url === 'string' ? row.url : null
  const text = typeof row.text === 'string' ? row.text : null
  const timestamp = typeof row.timestamp === 'number' ? row.timestamp : Number(row.timestamp)
  const txHash =
    typeof row.txHash === 'string' && row.txHash.startsWith('0x')
      ? (row.txHash as `0x${string}`)
      : null
  const block = typeof row.block === 'string' ? row.block : String(row.block ?? '')

  if (!id || !author || !url || text === null || !Number.isFinite(timestamp) || !txHash) {
    return null
  }

  return { id, author, url, text, timestamp, txHash, block }
}

function sortPosts(list: ForumPost[]) {
  return [...list].sort(
    (a, b) => b.timestamp - a.timestamp || Number(b.id) - Number(a.id),
  )
}

export function useForumIndexer() {
  const runtimeConfig = useRuntimeConfig()
  const appConfig = useAppConfig()

  const contractAddress = computed(() => {
    const value = runtimeConfig.public.forum.contractAddress
    return isForumConfigured(value) ? value : null
  })

  const chainKey = computed<SupportedChain>(() => {
    const configured = runtimeConfig.public.forum.chain
    if (configured === 'mainnet' || configured === 'sepolia') {
      return configured
    }
    const fallback = appConfig.evm?.defaultChain
    return fallback === 'mainnet' ? 'mainnet' : 'sepolia'
  })

  const visiblePosts = computed(() => posts.value.slice(0, visibleCount.value))
  const canLoadMore = computed(() => visibleCount.value < posts.value.length)
  const configured = computed(() => Boolean(contractAddress.value))

  async function loadPosts() {
    if (!indexer) {
      return
    }

    const rows = await indexer.store.getAll('posts')
    const parsed = rows
      .map(toForumPost)
      .filter((post): post is ForumPost => post !== null)

    posts.value = sortPosts(parsed)
  }

  function loadMore() {
    if (!canLoadMore.value) {
      return
    }
    visibleCount.value += PAGE_SIZE
  }

  async function refresh() {
    await loadPosts()
  }

  async function simulatePost(input?: { url?: string; text?: string }) {
    const post = createSimulatedPost({
      url: input?.url,
      text: input?.text,
      index: simulateCount++,
    })

    if (indexer) {
      await indexer.store.set('posts', post.id, post)
      await loadPosts()
      return post
    }

    posts.value = sortPosts([post, ...posts.value])
    return post
  }

  function stop() {
    unsubStatus?.()
    unsubChange?.()
    unsubStatus = null
    unsubChange = null
    indexer?.stop()
    indexer = null
    status.value = null
  }

  async function start() {
    if (startPromise) {
      await startPromise
      return
    }

    startPromise = (async () => {
      stop()
      error.value = null
      ready.value = false

      const address = contractAddress.value
      if (!address) {
        // Keep any in-memory simulated posts when no contract is configured.
        ready.value = true
        return
      }

      const chain = chainMap[chainKey.value]
      const rpcUrls =
        runtimeConfig.public.evm.chains?.[chainKey.value]?.rpcs
          ?.split(/\s+/)
          .map((value: string) => value.trim())
          .filter(Boolean) ?? []

      const client = createPublicClient({
        chain,
        transport: http(rpcUrls[0] || undefined),
      })

      const startBlock = BigInt(runtimeConfig.public.forum.startBlock || '0')

      try {
        indexer = createIndexer({
          // Peer viem versions can diverge between the app and local indexer package.
          client: client as never,
          store: createIdbStore('forum-posts'),
          version: 1,
          schema: {
            posts: {
              indexes: [{ name: 'by_timestamp', fields: ['timestamp'] }],
            },
          },
          contracts: {
            Forum: {
              abi: forumAbi,
              address,
              startBlock,
              events: {
                async PostCreated({ event, store }) {
                  const args = event.args as {
                    id: bigint
                    author: Address
                    url: string
                    text: string
                    timestamp: bigint
                  }

                  const id = String(args.id)
                  await store.set('posts', id, {
                    id,
                    author: args.author,
                    url: args.url,
                    text: args.text,
                    timestamp: Number(args.timestamp),
                    txHash: event.transactionHash,
                    block: String(event.block),
                  })
                },
              },
            },
          },
        })

        unsubStatus = indexer.onStatus((next) => {
          status.value = next
        })

        unsubChange = indexer.onChange((table) => {
          if (table === 'posts') {
            void loadPosts()
          }
        })

        await indexer.start()
        await loadPosts()
        ready.value = true
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to start indexer'
        ready.value = true
      }
    })()

    try {
      await startPromise
    } finally {
      startPromise = null
    }
  }

  if (!bootstrapped) {
    bootstrapped = true

    if (import.meta.client) {
      void start()
    }

    watch([contractAddress, chainKey], () => {
      void start()
    })
  }

  return {
    posts: visiblePosts,
    allPosts: posts,
    status,
    ready,
    error,
    configured,
    canLoadMore,
    loadMore,
    refresh,
    simulatePost,
  }
}
