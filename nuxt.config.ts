// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ['@1001-digital/layers.evm'],

  modules: ['convex-nuxt'],

  css: ['~/assets/css/app.css'],

  convex: {
    url:
      process.env.NUXT_PUBLIC_CONVEX_URL ||
      process.env.CONVEX_URL ||
      'https://hidden-swan-791.convex.cloud',
  },

  runtimeConfig: {
    public: {
      convexUrl:
        process.env.NUXT_PUBLIC_CONVEX_URL ||
        process.env.CONVEX_URL ||
        'https://hidden-swan-791.convex.cloud',
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
        contractAddress: '0x730733BB2D0C4dA33C9403d62529a8cE32CF33AA',
        vesselAddress: '0xecb92cc7112b80a2234936315bbb493fb48d1463',
        startBlock: '25732851',
        chain: 'mainnet',
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
