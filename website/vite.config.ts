import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const PLAYLISTS = [
  {
    id: 'PL_GvdPBZ-KR6cTAyzewASaUDbZt_B9POH',
    eyebrow: 'Feature demos',
    title: 'Short Multimeter feature demos',
    description: 'Quick, focused videos showing Multimeter features in action.',
  },
  {
    id: 'PL_GvdPBZ-KR4nlMq1dE8BryC75z8jzTfL',
    eyebrow: 'Step-by-step playlist',
    title: 'Watch Multimeter in action',
    description: 'Guided walkthroughs covering Multimeter from install to environment variables and API testing.',
  },
] as const
const VIRTUAL_MODULE_ID = 'virtual:youtube-playlist'
const RESOLVED_ID = '\0' + VIRTUAL_MODULE_ID

interface PlaylistVideo {
  id: string
  title: string
}

async function fetchPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const xml = await res.text()
    const videos: PlaylistVideo[] = []
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    let match: RegExpExecArray | null
    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1]
      const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/)
      if (idMatch && titleMatch) {
        videos.push({ id: idMatch[1], title: titleMatch[1] })
      }
    }
    return videos
  } catch (err) {
    console.warn(`[youtube-playlist] Failed to fetch playlist ${playlistId}, using empty list:`, err)
    return []
  }
}

function youtubePlaylistPlugin(): Plugin {
  let playlists: Array<(typeof PLAYLISTS)[number] & { videos: PlaylistVideo[] }> = []
  let fetched = false

  return {
    name: 'youtube-playlist',
    async buildStart() {
      if (!fetched) {
        playlists = await Promise.all(
          PLAYLISTS.map(async (playlist) => ({
            ...playlist,
            videos: await fetchPlaylistVideos(playlist.id),
          })),
        )
        fetched = true
        for (const playlist of playlists) {
          console.log(`[youtube-playlist] Loaded ${playlist.videos.length} videos from playlist ${playlist.id}`)
        }
      }
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_ID
      }
    },
    load(id) {
      if (id === RESOLVED_ID) {
        return `export const playlists = ${JSON.stringify(playlists)};`
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), youtubePlaylistPlugin()],
})
