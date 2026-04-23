import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const PLAYLIST_ID = 'PL_GvdPBZ-KR4nlMq1dE8BryC75z8jzTfL'
const VIRTUAL_MODULE_ID = 'virtual:youtube-playlist'
const RESOLVED_ID = '\0' + VIRTUAL_MODULE_ID

interface PlaylistVideo {
  id: string
  title: string
}

async function fetchPlaylistVideos(): Promise<PlaylistVideo[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}`
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
    console.warn('[youtube-playlist] Failed to fetch playlist, using empty list:', err)
    return []
  }
}

function youtubePlaylistPlugin(): Plugin {
  let videos: PlaylistVideo[] = []
  let fetched = false

  return {
    name: 'youtube-playlist',
    async buildStart() {
      if (!fetched) {
        videos = await fetchPlaylistVideos()
        fetched = true
        console.log(`[youtube-playlist] Loaded ${videos.length} videos from playlist ${PLAYLIST_ID}`)
      }
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_ID
      }
    },
    load(id) {
      if (id === RESOLVED_ID) {
        return `export const PLAYLIST_ID = ${JSON.stringify(PLAYLIST_ID)};
export const videos = ${JSON.stringify(videos)};`
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), youtubePlaylistPlugin()],
})
