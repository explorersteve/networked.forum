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

  nitro: {
    preset: process.env.VERCEL ? 'vercel' : 'node-cluster',
  },

  compatibilityDate: '2025-07-15',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
})
