// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ['@1001-digital/layers.evm'],

  css: ['~/assets/css/app.css'],

  runtimeConfig: {
    public: {
      evm: {
        walletConnectProjectId: '',
        chains: {
          mainnet: {
            rpcs: '',
          },
          sepolia: {
            rpcs: '',
          },
        },
        ens: {
          indexers: '',
        },
      },
      forum: {
        contractAddress: '',
        startBlock: '0',
        chain: 'sepolia',
      },
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  // Vercel auto-detects the Nitro preset. Prefer that over pinning node-server.
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
})
