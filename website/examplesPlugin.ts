import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import type { ExampleEntry, ExampleFile, ExampleTier } from './src/docs/exampleTypes'

export type { ExampleEntry, ExampleFile, ExampleTier } from './src/docs/exampleTypes'

const VIRTUAL_ID = 'virtual:examples'
const RESOLVED_ID = '\0' + VIRTUAL_ID

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.mmt',
  '.js',
  '.ts',
  '.json',
  '.yaml',
  '.yml',
  '.csv',
  '.bru',
  '.http',
  '.https',
  '.proto',
  '.txt',
  '.sh',
  '.env',
  '.xml',
  '.html',
  '.graphql',
  '.gql',
])

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'certs', '__pycache__'])
const MAX_FILE_BYTES = 200_000

function websiteRoot(): string {
  return path.dirname(fileURLToPath(import.meta.url))
}

function examplesRoot(): string {
  return path.resolve(websiteRoot(), '../examples')
}

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  if (TEXT_EXTENSIONS.has(ext)) {
    return true
  }
  // extensionless small files occasionally appear
  return ext === '' && path.basename(filePath).toLowerCase() === 'dockerfile'
}

function walkFiles(dir: string, base: string, out: string[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue
      }
      walkFiles(full, base, out)
      continue
    }
    if (!entry.isFile() || !isTextFile(full)) {
      continue
    }
    const rel = path.relative(base, full).split(path.sep).join('/')
    out.push(rel)
  }
}

function parseReadmeMeta(readme: string): { title: string; description: string } {
  const titleMatch = readme.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1]?.trim() ?? ''
  const lines = readme.split(/\r?\n/)
  let description = ''
  let pastTitle = false
  for (const line of lines) {
    if (!pastTitle) {
      if (/^#\s+/.test(line)) {
        pastTitle = true
      }
      continue
    }
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('```')) {
      if (description) {
        break
      }
      continue
    }
    description = trimmed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    break
  }
  return { title, description }
}

function titleFromSlug(slug: string): string {
  return slug
    .replace(/^\d+_/, '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function loadTier(): ExampleEntry[] {
  const root = examplesRoot()
  const tiers: ExampleTier[] = ['basic', 'intermediate', 'professional']
  const examples: ExampleEntry[] = []

  for (const tier of tiers) {
    const tierDir = path.join(root, tier)
    if (!fs.existsSync(tierDir)) {
      continue
    }
    const folders = fs
      .readdirSync(tierDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort()

    for (const slug of folders) {
      const folder = path.join(tierDir, slug)
      const relPaths: string[] = []
      walkFiles(folder, folder, relPaths)
      relPaths.sort((a, b) => {
        if (a === 'README.md') {
          return -1
        }
        if (b === 'README.md') {
          return 1
        }
        return a.localeCompare(b)
      })

      const files: ExampleFile[] = []
      for (const rel of relPaths) {
        const full = path.join(folder, rel)
        try {
          const stat = fs.statSync(full)
          if (stat.size > MAX_FILE_BYTES) {
            files.push({
              path: rel,
              content: `// File too large to embed (${stat.size} bytes)`,
            })
            continue
          }
          const content = fs.readFileSync(full, 'utf8')
          files.push({ path: rel, content })
        } catch {
          // skip unreadable
        }
      }

      const readme = files.find((f) => f.path === 'README.md')?.content ?? ''
      const meta = parseReadmeMeta(readme)
      examples.push({
        tier,
        slug,
        title: meta.title || titleFromSlug(slug),
        description: meta.description || '',
        files,
      })
    }
  }

  return examples
}

export function examplesPlugin(): Plugin {
  let cached: ExampleEntry[] | null = null

  const getExamples = () => {
    if (!cached) {
      cached = loadTier()
      console.log(`[examples] Loaded ${cached.length} example folders from ${examplesRoot()}`)
    }
    return cached
  }

  return {
    name: 'mmt-examples',
    buildStart() {
      cached = null
      getExamples()
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) {
        return RESOLVED_ID
      }
    },
    load(id) {
      if (id === RESOLVED_ID) {
        const examples = getExamples()
        return `export const examples = ${JSON.stringify(examples)};`
      }
    },
    configureServer(server) {
      const root = examplesRoot()
      server.watcher.add(root)
      server.watcher.on('change', (file) => {
        if (file.startsWith(root)) {
          cached = null
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
          if (mod) {
            server.moduleGraph.invalidateModule(mod)
          }
          server.ws.send({ type: 'full-reload' })
        }
      })
    },
  }
}
