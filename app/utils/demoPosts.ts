import type { Address } from 'viem'
import type { ForumPost } from '~/utils/forum'

const DEMO_AUTHORS = [
  '0x1111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222',
  '0x3333333333333333333333333333333333333333',
  '0x4444444444444444444444444444444444444444',
] as const satisfies readonly Address[]

export const DEMO_POST_SAMPLES = [
  {
    url: 'https://networked.art/visualizevalue/0x93f8d1ae4a9bf3ede3b11796a5c378b761e913cc/5',
    text: 'Quiet confidence in the composition. The kind of piece that slows the scroll.',
  },
  {
    url: 'https://networked.art/infiniteyay/0x097bbb793058d5b242356c92da8577cd4d27ab0e/1',
    text: 'Still thinking about the color temperature here. Soft, but not sentimental.',
  },
  {
    url: 'https://networked.art/sheipiter/0x46ea369e85db06ab64e1130b179990d07d96163c/2',
    text: 'Feels like a memory of a place I have never been. Happy to see it here.',
  },
  {
    url: 'https://networked.art/serc/0x0bf949203955d15d9104d3e5e5910eab378de08b/1',
    text: 'Sharp edges, patient pacing. This one rewards a second look.',
  },
] as const

function fakeTxHash(seed: number): `0x${string}` {
  const hex = seed.toString(16).padStart(64, '0').slice(-64)
  return `0x${hex}`
}

export function createSimulatedPost(input?: {
  url?: string
  text?: string
  index?: number
}): ForumPost {
  const index = input?.index ?? 0
  const sample = DEMO_POST_SAMPLES[index % DEMO_POST_SAMPLES.length]!
  const now = Math.floor(Date.now() / 1000)
  const id = `sim-${now}-${index}`

  return {
    id,
    author: DEMO_AUTHORS[index % DEMO_AUTHORS.length]!,
    url: input?.url?.trim() || sample.url,
    text: input?.text?.trim() || sample.text,
    timestamp: now - index * 90,
    txHash: fakeTxHash(now + index),
    block: String(18_000_000 + index),
  }
}
