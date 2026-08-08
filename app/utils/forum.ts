import { parseAbi, type Address } from 'viem'

export const forumAbi = parseAbi([
  'function post(string url, string text)',
  'event PostCreated(uint256 indexed id, address indexed author, string url, string text, uint256 timestamp)',
])

export type ForumPost = {
  id: string
  author: Address
  url: string
  text: string
  timestamp: number
  txHash: `0x${string}`
  block: string
}

export function isForumConfigured(address: string | undefined): address is Address {
  return Boolean(address && /^0x[a-fA-F0-9]{40}$/.test(address))
}
