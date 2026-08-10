import {
  decodeFunctionData,
  getAddress,
  hexToString,
  isHex,
  parseAbi,
  type Hex,
} from 'viem'
import {
  artistSlugFromPath,
  buildNetworkedArtUrl,
  extractNetworkedArtPath,
} from './networkedArt'

export const openVaultAbi = parseAbi([
  'function setEntryPublic(bytes _entry)',
  'function setToken(uint256 _tokenId)',
  'function vaultTokenNum() view returns (uint256)',
  'function vessel() view returns (address)',
])

export const vesselAbi = parseAbi([
  'event PayloadSet(uint256 _tokenId, uint256 _length)',
  'function setPayloadHolder(uint256 _tokenId, bytes _bytes)',
  'function craftToPayload(uint256 _tokenId) view returns (bytes)',
])

export function addressesEqual(a: string, b: string): boolean {
  try {
    return getAddress(a) === getAddress(b)
  } catch {
    return a.toLowerCase() === b.toLowerCase()
  }
}

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

export function parseForumPayload(entry: Hex | string): {
  path: string
  url: string
  text: string
  artistSlug: string | null
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

  return {
    path,
    url,
    text: normalized.trim(),
    artistSlug: artistSlugFromPath(path),
  }
}
