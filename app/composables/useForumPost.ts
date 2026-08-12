import { api } from '../../convex/_generated/api'
import { isTxHash, toForumPost, type ForumPost } from '~/utils/forum'

export function useForumPost(txHash: MaybeRefOrGetter<string>) {
  const normalized = computed(() => String(toValue(txHash)).toLowerCase())
  const valid = computed(() => isTxHash(normalized.value))

  const { data, error, isPending, suspense } = useConvexQuery(
    api.posts.getByTx,
    () => ({ txHash: normalized.value }),
  )

  const post = computed<ForumPost | null>(() => {
    const row = data.value
    return row ? toForumPost(row) : null
  })

  const ready = computed(() => !isPending.value || data.value !== undefined)

  return {
    post,
    ready,
    valid,
    error: computed(() => (error.value ? error.value.message : null)),
    suspense,
  }
}
