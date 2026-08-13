export type ArtworkPlatform = {
  name: string
  src: string
  href: string
}

/** Supported artwork sources shown next to “Artwork URL”. Add entries here. */
export const artworkPlatforms: ArtworkPlatform[] = [
  {
    name: 'Networked.art',
    src: '/platforms/networked.svg',
    href: 'https://networked.art',
  },
  {
    name: 'OpenSea',
    src: '/platforms/opensea.svg',
    href: 'https://opensea.io',
  },
  {
    name: 'Art Blocks',
    src: '/platforms/artblocks.png',
    href: 'https://www.artblocks.io',
  },
]
