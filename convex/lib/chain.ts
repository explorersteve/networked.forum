import { createPublicClient, http, type PublicClient } from 'viem'
import { mainnet, sepolia } from 'viem/chains'

export type ForumChain = 'sepolia' | 'mainnet'

const chainMap = {
  sepolia,
  mainnet,
} as const

export function getForumChain(): ForumChain {
  const value = process.env.FORUM_CHAIN
  return value === 'mainnet' ? 'mainnet' : 'sepolia'
}

export function getForumConfig() {
  const chain = getForumChain()
  const rpcUrl =
    chain === 'mainnet'
      ? process.env.MAINNET_RPC_URL
      : process.env.SEPOLIA_RPC_URL

  const contractAddress = process.env.FORUM_CONTRACT_ADDRESS
  const vesselAddress = process.env.FORUM_VESSEL_ADDRESS
  const startBlock = Number(process.env.FORUM_START_BLOCK || '0')

  if (!rpcUrl) {
    throw new Error(
      `Missing ${chain === 'mainnet' ? 'MAINNET_RPC_URL' : 'SEPOLIA_RPC_URL'}`,
    )
  }
  if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    throw new Error('Missing or invalid FORUM_CONTRACT_ADDRESS')
  }
  if (!vesselAddress || !/^0x[a-fA-F0-9]{40}$/.test(vesselAddress)) {
    throw new Error('Missing or invalid FORUM_VESSEL_ADDRESS')
  }

  return {
    chain,
    rpcUrl,
    contractAddress: contractAddress as `0x${string}`,
    vesselAddress: vesselAddress as `0x${string}`,
    startBlock: Number.isFinite(startBlock) ? startBlock : 0,
  }
}

export function createForumClient(): PublicClient {
  const { chain, rpcUrl } = getForumConfig()
  return createPublicClient({
    chain: chainMap[chain],
    transport: http(rpcUrl),
  }) as PublicClient
}
