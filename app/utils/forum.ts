import {
  decodeFunctionData,
  getAddress,
  hexToString,
  isHex,
  parseAbi,
  type Address,
  type Hex,
} from 'viem'
import { buildNetworkedArtUrl, extractNetworkedArtPath } from '~/utils/networkedArt'

/** OpenVault — writes UTF-8 post payload bytes to the Vessel token. */
export const openVaultAbi = parseAbi([
  'function setEntryPublic(bytes _entry)',
  'function setToken(uint256 _tokenId)',
  'function vaultTokenNum() view returns (uint256)',
  'function vessel() view returns (address)',
])

/** Vessel — payload writes emit PayloadSet without the bytes content. */
export const vesselAbi = parseAbi([
  'event PayloadSet(uint256 _tokenId, uint256 _length)',
  'function setPayloadHolder(uint256 _tokenId, bytes _bytes)',
  'function craftToPayload(uint256 _tokenId) view returns (bytes)',
])

/** Mainnet Vessel used by OpenVault. */
export const DEFAULT_VESSEL_ADDRESS =
  '0xecb92cc7112b80a2234936315bbb493fb48d1463' as const satisfies Address

export type ForumPost = {
  id: string
  author: Address
  url: string
  text: string
  timestamp: number
  txHash: `0x${string}`
  block: string
  title: string
  artist: string
  imageUrl?: string
}

export function isForumConfigured(address: string | undefined): address is Address {
  return Boolean(address && /^0x[a-fA-F0-9]{40}$/.test(address))
}

export function parseForumPayload(entry: Hex | string): {
  path: string
  url: string
  text: string
} | null {
  let text: string
  try {
    text = isHex(entry) ? hexToString(entry) : entry
  } catch {
    return null
  }

  const normalized = text.replace(/\r\n/g, '\n')
  const firstLine = normalized.split('\n')[0]?.trim() ?? ''
  const path = extractNetworkedArtPath(firstLine)
  if (!path) {
    return null
  }

  const url = buildNetworkedArtUrl(path)
  if (!url) {
    return null
  }

  return { path, url, text: normalized.trim() }
}

/** Decode OpenVault.setEntryPublic calldata into a forum payload. */
export function decodeOpenVaultEntry(data: Hex): Hex | null {
  try {
    const decoded = decodeFunctionData({
      abi: openVaultAbi,
      data,
    })
    if (decoded.functionName !== 'setEntryPublic') {
      return null
    }
    const entry = decoded.args[0]
    return typeof entry === 'string' && isHex(entry) ? entry : null
  } catch {
    return null
  }
}

export function addressesEqual(a: string, b: string): boolean {
  try {
    return getAddress(a) === getAddress(b)
  } catch {
    return a.toLowerCase() === b.toLowerCase()
  }
}

export function forumPostId(block: bigint | string | number, logIndex: number): string {
  return `${block}:${logIndex}`
}
