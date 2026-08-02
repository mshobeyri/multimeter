declare module 'virtual:youtube-playlist' {
  export const playlists: Array<{
    id: string
    eyebrow: string
    title: string
    description: string
    videos: Array<{ id: string; title: string; description: string }>
  }>
}

declare module 'virtual:examples' {
  export type ExampleTier = 'basic' | 'intermediate' | 'professional'
  export type ExampleFile = {
    path: string
    content: string
  }
  export type ExampleEntry = {
    tier: ExampleTier
    slug: string
    title: string
    description: string
    files: ExampleFile[]
  }
  export const examples: ExampleEntry[]
}

declare module '*.md?raw' {
  const content: string
  export default content
}
