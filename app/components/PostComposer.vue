<script setup lang="ts">
import { writeContract } from '@wagmi/core'
import { useAccount, useConfig } from '@wagmi/vue'
import type { Hash } from 'viem'
import { forumAbi, isForumConfigured } from '~/utils/forum'
import { extractNetworkedArtPath } from '~/utils/networkedArt'

const emit = defineEmits<{
  posted: []
  simulate: [{ url?: string; text?: string }]
}>()

const runtimeConfig = useRuntimeConfig()
const wagmiConfig = useConfig()
const { address, isConnected } = useAccount()

const artworkUrl = ref('')
const text = ref('')
const simulating = ref(false)
const textAreaRef = ref<HTMLTextAreaElement | null>(null)

const { preview, pending, error, normalizedUrl } = useArtworkPreview(artworkUrl)

const artworkPath = computed(() => extractNetworkedArtPath(artworkUrl.value))

/** Path (required) plus optional body — what gets posted onchain. */
const composedText = computed(() => {
  const path = artworkPath.value
  const body = text.value.trim()
  if (path && body) {
    return `${path}\n\n${body}`
  }
  return path || body
})

watch(artworkPath, async (path) => {
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

const chainKey = computed(() => runtimeConfig.public.forum.chain || 'sepolia')

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

  return await writeContract(wagmiConfig, {
    address: contractAddress.value,
    abi: forumAbi,
    functionName: 'post',
    args: [normalizedUrl.value, composedText.value],
  })
}

function onComplete() {
  artworkUrl.value = ''
  text.value = ''
  emit('posted')
}

async function simulateTransaction() {
  if (simulating.value) {
    return
  }

  simulating.value = true
  try {
    // Brief delay so the control feels like a transaction round-trip.
    await new Promise((resolve) => setTimeout(resolve, 900))
    emit('simulate', {
      url: normalizedUrl.value || undefined,
      text: composedText.value || undefined,
    })
    artworkUrl.value = ''
    text.value = ''
  } finally {
    simulating.value = false
  }
}
</script>

<template>
  <section class="composer">
    <p class="section-label">New post</p>

    <div class="composer__grid">
      <ArtworkPreview
        :href="normalizedUrl || '#'"
        :image="preview?.image"
        :title="preview?.title"
        :pending="pending && Boolean(normalizedUrl)"
      />

      <div class="composer__fields">
        <FormLabel label="Networked.art URL">
          <input
            v-model="artworkUrl"
            type="url"
            placeholder="https://networked.art/…/0x…/1"
            autocomplete="off"
            spellcheck="false"
          />
        </FormLabel>

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
            />
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
                :chain="chainKey"
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
                    confirm: 'This submits an onchain transaction to publish your post.',
                    waiting: 'Waiting for the transaction to confirm…',
                  },
                }"
                @complete="onComplete"
              >
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

          <Button
            v-if="!contractAddress"
            class="primary"
            :disabled="simulating"
            @click="simulateTransaction"
          >
            {{ simulating ? 'Simulating…' : 'Simulate post' }}
          </Button>

          <p
            v-if="!contractAddress"
            class="composer__hint"
          >
            No contract yet — this adds a local demo post so you can check the feed.
          </p>

          <p
            v-else-if="isConnected && address"
            class="composer__hint"
          >
            Connected as
            <EvmAccount :address="address" />
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
