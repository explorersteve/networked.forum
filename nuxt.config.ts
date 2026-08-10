// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ['@1001-digital/layers.evm'],

  modules: ['convex-nuxt'],

  css: ['~/assets/css/app.css'],

  convex: {
    url:
      process.env.NUXT_PUBLIC_CONVEX_URL ||
      process.env.CONVEX_URL ||
      'https://oceanic-pelican-229.convex.cloud',
  },

  runtimeConfig: {
    public: {
      convexUrl:
        process.env.NUXT_PUBLIC_CONVEX_URL ||
        process.env.CONVEX_URL ||
        'https://oceanic-pelican-229.convex.cloud',
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
        vesselAddress: '0x1bbf5064e2238d9C9D993A6Bc15aE86e6f2f57eC',
        startBlock: '11459856',
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
