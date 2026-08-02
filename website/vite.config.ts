import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { demoPlaylist } from './demoPlaylist'
import { tutorialPlaylist } from './tutorialPlaylist'
import { examplesPlugin } from './examplesPlugin'

const websiteRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(websiteRoot, '..')

const VIRTUAL_MODULE_ID = 'virtual:youtube-playlist'
const RESOLVED_ID = '\0' + VIRTUAL_MODULE_ID

interface PlaylistVideo {
  id: string
  title: string
  description: string
}

interface StoredPlaylist {
  id: string
  eyebrow: string
  title: string
  description: string
  videos: readonly PlaylistVideo[]
}

type PlaylistEntry = Omit<StoredPlaylist, 'videos'> & { videos: PlaylistVideo[] }

const PLAYLISTS: readonly StoredPlaylist[] = [demoPlaylist, tutorialPlaylist]

function withStoredPlaylistData(playlist: PlaylistEntry): PlaylistEntry {
  const snapshot = PLAYLISTS.find((item) => item.id === playlist.id)
  if (!snapshot) {
    return playlist
  }

  if (playlist.videos.length === 0) {
    console.warn(
      `[youtube-playlist] Using stored fallback for playlist ${playlist.id} with ${snapshot.videos.length} videos`,
    )

    return {
      ...snapshot,
      videos: snapshot.videos.map((video) => ({ ...video })),
    }
  }

  const storedVideos = new Map(snapshot.videos.map((video) => [video.id, video]))
  const videos = playlist.videos.map((video) => {
    const storedVideo = storedVideos.get(video.id)

    return {
      ...video,
      description: video.description || storedVideo?.description || '',
    }
  })

  const restoredDescriptions = videos.filter((video, index) => !playlist.videos[index].description && video.description).length
  if (restoredDescriptions > 0) {
    console.warn(
      `[youtube-playlist] Restored ${restoredDescriptions} descriptions from stored playlist data for ${playlist.id}`,
    )
  }

  return {
    ...playlist,
    videos,
  }
}

function stripHashtags(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/#[\p{L}\p{N}_-]+/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .join('\n')
    .trim()
}

function readText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => readText(item)).join('').trim()
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const record = value as Record<string, unknown>

  if (typeof record.simpleText === 'string') {
    return record.simpleText
  }

  if (Array.isArray(record.runs)) {
    return record.runs.map((item) => readText(item)).join('').trim()
  }

  if (typeof record.text === 'string') {
    return record.text
  }

  return ''
}

function decodeJsonString(value: string): string {
  return JSON.parse(`"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`) as string
}

async function fetchVideoDescription(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const html = await res.text()
  const match = html.match(/"shortDescription":"((?:\\.|[^"])*)"/)
  if (!match) {
    return ''
  }

  return stripHashtags(readText(decodeJsonString(match[1])))
}

async function fetchPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  const url = `https://www.youtube.com/playlist?list=${playlistId}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const html = await res.text()
    const compactHtml = html.replace(/\n/g, '')
    const videoRegex = /"playlistVideoRenderer":\{"videoId":"([^"]+)"[\s\S]*?"title":\{"runs":\[\{"text":"((?:\\.|[^"])*)"\}\]/g
    const baseVideos: PlaylistVideo[] = []
    const seen = new Set<string>()
    let match: RegExpExecArray | null

    while ((match = videoRegex.exec(compactHtml)) !== null) {
      const id = match[1]
      const title = readText(decodeJsonString(match[2]))
      if (id && title && !seen.has(id)) {
        seen.add(id)
        baseVideos.push({ id, title, description: '' })
      }
    }

    const descriptions = await Promise.all(
      baseVideos.map(async (video) => {
        try {
          return await fetchVideoDescription(video.id)
        } catch {
          return ''
        }
      }),
    )

    return baseVideos.map((video, index) => ({
      ...video,
      description: descriptions[index],
    }))
  } catch (err) {
    console.warn(`[youtube-playlist] Failed to fetch playlist ${playlistId}, using empty list:`, err)
    return []
  }
}

function youtubePlaylistPlugin(): Plugin {
  let playlists: PlaylistEntry[] = []
  let fetched = false

  return {
    name: 'youtube-playlist',
    async buildStart() {
      if (!fetched) {
        playlists = await Promise.all(
          PLAYLISTS.map(async (playlist) =>
            withStoredPlaylistData({
              ...playlist,
              videos: await fetchPlaylistVideos(playlist.id),
            }),
          ),
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

function docsAssetsPlugin(): Plugin {
  const docsRoot = path.resolve(repoRoot, 'docs')
  const mount = '/docs-assets'

  return {
    name: 'docs-assets',
    configureServer(server) {
      // Docs live outside website/; watch them and refresh the eager markdown glob.
      server.watcher.add(docsRoot)
      server.watcher.on('change', (file) => {
        if (!file.startsWith(docsRoot) || !file.endsWith('.md')) {
          return
        }
        const normalized = file.split(path.sep).join('/')
        for (const [id, mod] of server.moduleGraph.idToModuleMap) {
          const nid = id.split(path.sep).join('/')
          if (
            nid.includes(normalized) ||
            nid.includes('/docs/loadContent') ||
            nid.includes('docs/**/*.md')
          ) {
            server.moduleGraph.invalidateModule(mod)
          }
        }
        server.ws.send({ type: 'full-reload' })
      })
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith(`${mount}/`)) {
          next()
          return
        }
        const rel = decodeURIComponent(url.slice(mount.length + 1).split('?')[0])
        const filePath = path.resolve(docsRoot, rel)
        if (!filePath.startsWith(docsRoot) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        const ext = path.extname(filePath).toLowerCase()
        const types: Record<string, string> = {
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.md': 'text/markdown; charset=utf-8',
        }
        res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
        fs.createReadStream(filePath).pipe(res)
      })
    },
    closeBundle() {
      const outDir = path.resolve(websiteRoot, 'dist', 'docs-assets')
      const copyRecursive = (from: string, to: string) => {
        if (!fs.existsSync(from)) {
          return
        }
        fs.mkdirSync(to, { recursive: true })
        for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
          if (entry.name.startsWith('.')) {
            continue
          }
          const src = path.join(from, entry.name)
          const dest = path.join(to, entry.name)
          if (entry.isDirectory()) {
            // Skip AI and large non-media trees; copy media folders only
            if (['AI', 'tasks', 'files', 'features', 'guides', 'running'].includes(entry.name)) {
              continue
            }
            copyRecursive(src, dest)
          } else if (/\.(mp4|webm|png|jpe?g|gif|webp|svg)$/i.test(entry.name)) {
            fs.copyFileSync(src, dest)
          }
        }
      }
      copyRecursive(docsRoot, outDir)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), youtubePlaylistPlugin(), examplesPlugin(), docsAssetsPlugin()],
  server: {
    fs: {
      allow: [websiteRoot, repoRoot],
    },
    watch: {
      // Docs markdown lives outside website/; ensure HMR picks up edits.
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
})
