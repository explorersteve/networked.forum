# Forum

Nuxt EVM artwork forum built with [@1001-digital/layers.evm](https://github.com/1001-digital/layers).

Connect a wallet, paste a [Networked.art](https://networked.art) artwork link, write about it, submit an onchain transaction, and see the post in a two-column feed.

## Setup

```sh
pnpm install
cp .env.example .env
pnpm dev
```

## Environment

| Variable | Purpose |
| --- | --- |
| `NUXT_PUBLIC_EVM_WALLET_CONNECT_PROJECT_ID` | WalletConnect project id |
| `NUXT_PUBLIC_EVM_CHAINS_MAINNET_RPCS` | Space-separated Ethereum RPC URLs |
| `NUXT_PUBLIC_EVM_CHAINS_SEPOLIA_RPCS` | Space-separated Sepolia RPC URLs |
| `NUXT_PUBLIC_FORUM_CONTRACT_ADDRESS` | Deployed forum contract address |
| `NUXT_PUBLIC_FORUM_START_BLOCK` | Indexer start block |
| `NUXT_PUBLIC_FORUM_CHAIN` | `sepolia` or `mainnet` |

Posting stays disabled until `NUXT_PUBLIC_FORUM_CONTRACT_ADDRESS` is set.

## Contract stub

Expected interface (implement and deploy separately):

```solidity
function post(string url, string text);
event PostCreated(
  uint256 indexed id,
  address indexed author,
  string url,
  string text,
  uint256 timestamp
);
```

ABI lives in `app/utils/forum.ts`.

## Architecture

1. Artwork preview: `/api/preview` fetches Networked.art HTML, reads `og:image`, and unwraps the embedded CDN image from `_og` URLs.
2. Posting: `EvmTransactionFlowDialog` + `writeContract` calls `post(url, text)`.
3. Feed: browser `simple-indexer` stores `PostCreated` events in IndexedDB and paginates newest-first.

## Scripts

```sh
pnpm dev
pnpm typecheck
pnpm build
```

## Deploy on Vercel

1. Import [explorersteve/networked.forum](https://github.com/explorersteve/networked.forum) in Vercel.
2. Framework preset should be **Nuxt.js** (auto-detected).
3. Install command: `pnpm install` · Build command: `pnpm build` · Output: leave default.
4. Add the environment variables from `.env.example` in the Vercel project settings (Production + Preview).

Required for a working production deploy:

- `NUXT_PUBLIC_EVM_WALLET_CONNECT_PROJECT_ID`
- `NUXT_PUBLIC_EVM_CHAINS_MAINNET_RPCS` / `NUXT_PUBLIC_EVM_CHAINS_SEPOLIA_RPCS`
- `NUXT_PUBLIC_FORUM_CONTRACT_ADDRESS` (posting stays disabled until set)
- `NUXT_PUBLIC_FORUM_START_BLOCK`
- `NUXT_PUBLIC_FORUM_CHAIN` (`sepolia` or `mainnet`)
