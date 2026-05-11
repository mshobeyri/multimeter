declare module 'virtual:youtube-playlist' {
  export const playlists: Array<{
    id: string
    eyebrow: string
    title: string
    description: string
    videos: Array<{ id: string; title: string }>
  }>
}
