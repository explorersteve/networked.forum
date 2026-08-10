import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'

const http = httpRouter()

type AlchemyActivity = {
  hash?: string
  transactionHash?: string
}

type AlchemyWebhookBody = {
  type?: string
  event?: {
    activity?: AlchemyActivity[]
    transaction?: { hash?: string }
  }
}

function extractTxHashes(body: AlchemyWebhookBody): string[] {
  const hashes = new Set<string>()

  for (const activity of body.event?.activity ?? []) {
    const hash = activity.hash || activity.transactionHash
    if (hash && /^0x[a-fA-F0-9]{64}$/i.test(hash)) {
      hashes.add(hash.toLowerCase())
    }
  }

  const single = body.event?.transaction?.hash
  if (single && /^0x[a-fA-F0-9]{64}$/i.test(single)) {
    hashes.add(single.toLowerCase())
  }

  return Array.from(hashes)
}

async function verifyAlchemySignature(
  rawBody: string,
  signature: string | null,
  signingKey: string,
): Promise<boolean> {
  if (!signature) {
    return false
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody),
  )

  const digest = Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  if (digest.length !== signature.length) {
    return false
  }

  // Constant-time-ish compare
  let mismatch = 0
  for (let i = 0; i < digest.length; i += 1) {
    mismatch |= digest.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

http.route({
  path: '/alchemy/openVault',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY
    if (!signingKey) {
      console.error('ALCHEMY_WEBHOOK_SIGNING_KEY is not set')
      return new Response('Webhook not configured', { status: 500 })
    }

    const rawBody = await request.text()
    const signature = request.headers.get('x-alchemy-signature')
    const valid = await verifyAlchemySignature(rawBody, signature, signingKey)
    if (!valid) {
      return new Response('Invalid signature', { status: 401 })
    }

    let body: AlchemyWebhookBody
    try {
      body = JSON.parse(rawBody) as AlchemyWebhookBody
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    const hashes = extractTxHashes(body)
    for (const txHash of hashes) {
      await ctx.scheduler.runAfter(0, internal.postsActions.indexFromTx, {
        txHash,
      })
    }

    return new Response(JSON.stringify({ ok: true, queued: hashes.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
})

// Alchemy (and others) may probe with GET
http.route({
  path: '/alchemy/openVault',
  method: 'GET',
  handler: httpAction(async () => {
    return new Response('ok', { status: 200 })
  }),
})

export default http
