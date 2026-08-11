<script setup lang="ts">
import { writeContract } from '@wagmi/core'
import { useAccount, useConfig } from '@wagmi/vue'
import { stringToHex, type Hash, type TransactionReceipt } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import { isForumConfigured, openVaultAbi } from '~/utils/forum'
import { extractNetworkedArtPath } from '~/utils/networkedArt'

const forumChains = {
  sepolia,
  mainnet,
} as const

const emit = defineEmits<{
  posted: []
}>()

const runtimeConfig = useRuntimeConfig()
const wagmiConfig = useConfig()
const { isConnected, chainId } = useAccount()
const { indexConfirmedPost } = useForumPosts()

const MAX_CHARS = 6000
/** Blank line between path and body in the onchain payload (`\n\n`). */
const PATH_BODY_SEPARATOR = '\n\n'

const artworkUrl = ref('')
const text = ref('')
const textAreaRef = ref<HTMLTextAreaElement | null>(null)

const { preview, pending, error, normalizedUrl } = useArtworkPreview(artworkUrl)

const artworkPath = computed(() => extractNetworkedArtPath(artworkUrl.value))

/** Path length + separator bytes when a slug is present; otherwise 0. */
const prefixLength = computed(() => {
  const path = artworkPath.value
  return path ? path.length + PATH_BODY_SEPARATOR.length : 0
})

const characterCount = computed(() => prefixLength.value + text.value.length)

const textMaxLength = computed(() =>
  Math.max(0, MAX_CHARS - prefixLength.value),
)

/** Path (required) plus optional body — UTF-8 encoded as bytes onchain. */
const composedText = computed(() => {
  const path = artworkPath.value
  const body = text.value.trim()
  if (path && body) {
    return `${path}${PATH_BODY_SEPARATOR}${body}`
  }
  return path || body
})

watch(artworkPath, async (path) => {
  const maxBody = Math.max(0, MAX_CHARS - (path ? path.length + PATH_BODY_SEPARATOR.length : 0))
  if (text.value.length > maxBody) {
    text.value = text.value.slice(0, maxBody)
  }
  if (!path) {
    return
  }
  await nextTick()
  focusTextArea()
})

function focusTextArea() {
  textAreaRef.value?.focus()
}

const contractAddress = computed(() => {
  const value = runtimeConfig.public.forum.contractAddress
  return isForumConfigured(value) ? value : null
})

const chainKey = computed(() => {
  const configured = runtimeConfig.public.forum.chain
  return configured === 'mainnet' ? 'mainnet' : 'sepolia'
})

const targetChain = computed(() => forumChains[chainKey.value])

const canPost = computed(
  () =>
    Boolean(
      isConnected.value &&
        contractAddress.value &&
        normalizedUrl.value &&
        preview.value?.image &&
        composedText.value.length > 0,
    ),
)

async function submitPost(): Promise<Hash> {
  if (!contractAddress.value || !normalizedUrl.value) {
    throw new Error('Forum contract is not configured')
  }

  const expectedChainId = targetChain.value.id
  if (chainId.value !== expectedChainId) {
    throw new Error(
      `Wrong network. Switch to ${targetChain.value.name} (chain ${expectedChainId}) before posting.`,
    )
  }

  const entry = stringToHex(composedText.value)

  return await writeContract(wagmiConfig, {
    address: contractAddress.value,
    abi: openVaultAbi,
    functionName: 'setEntryPublic',
    args: [entry],
    chainId: expectedChainId,
  })
}

async function onComplete(receipt?: TransactionReceipt) {
  const titleHint = preview.value?.title
  const imageUrlHint = preview.value?.image

  artworkUrl.value = ''
  text.value = ''

  if (receipt?.transactionHash) {
    try {
      await indexConfirmedPost({
        txHash: receipt.transactionHash,
        titleHint,
        imageUrlHint,
      })
    } catch (err) {
      console.error('Failed to index post into Convex', err)
    }
  }

  emit('posted')
}
</script>

<template>
  <section class="composer">
    <p class="section-label">New Post</p>

    <div class="composer__grid">
      <ArtworkPreview
        :href="normalizedUrl || '#'"
        :image="preview?.image"
        :title="preview?.title"
        :pending="pending && Boolean(normalizedUrl)"
      />

      <div class="composer__fields">
        <div class="composer__url-field">
          <div id="networked-art-url-label">
            <a
              href="https://networked.art"
              target="_blank"
              rel="noopener noreferrer"
            >Networked.art</a>
            URL
          </div>
          <input
            v-model="artworkUrl"
            type="url"
            placeholder="https://networked.art/…/0x…/1"
            autocomplete="off"
            spellcheck="false"
            aria-labelledby="networked-art-url-label"
          />
        </div>

        <p
          v-if="error"
          class="composer__hint"
        >
          {{ error.message || 'Could not load artwork preview' }}
        </p>

        <FormLabel label="Text">
          <div
            class="composer__text"
            @click="focusTextArea"
          >
            <p
              v-if="artworkPath"
              class="composer__text-path"
            >
              {{ artworkPath }}
            </p>
            <div
              v-if="artworkPath"
              class="composer__text-rule"
              role="separator"
            />
            <textarea
              ref="textAreaRef"
              v-model="text"
              placeholder="Write something about the artwork"
              rows="5"
              :maxlength="textMaxLength"
            />
            <p
              class="composer__text-count"
              aria-live="polite"
            >
              {{ characterCount }}/{{ MAX_CHARS }} characters
            </p>
          </div>
        </FormLabel>

        <div class="composer__actions">
          <ClientOnly>
            <EvmConnectDialog
              v-if="!isConnected"
              class-name="wallet-button"
            >
              <template #default>
                Connect wallet
              </template>
            </EvmConnectDialog>

            <template v-else>
              <EvmTransactionFlowDialog
                v-if="contractAddress"
                :chain="targetChain.id"
                :request="submitPost"
                :text="{
                  title: {
                    confirm: 'Publish post',
                    requesting: 'Confirm in wallet',
                    waiting: 'Waiting for confirmation',
                    complete: 'Posted',
                  },
                  action: {
                    confirm: 'Post',
                    error: 'Retry',
                  },
                  lead: {
                    confirm: '',
                    waiting: 'Waiting for the transaction to confirm…',
                  },
                }"
                @complete="onComplete"
              >
                <template #confirm>
                  <p>
                    This transaction writes your post immutably on-chain and
                    adds it to the feed. You cannot edit it later.
                  </p>
                  <p class="post-gas-note">
                    Choose slow gas before submitting your transaction.
                  </p>
                </template>

                <template #start="{ start }">
                  <Button
                    class="primary"
                    :disabled="!canPost"
                    @click="start"
                  >
                    Post
                  </Button>
                </template>
              </EvmTransactionFlowDialog>
            </template>
          </ClientOnly>

          <p
            v-if="!contractAddress"
            class="composer__hint"
          >
            Set
            <code>NUXT_PUBLIC_FORUM_CONTRACT_ADDRESS</code>
            to your OpenVault address to enable posting.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.post-gas-note {
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
