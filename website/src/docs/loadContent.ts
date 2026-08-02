const modules = import.meta.glob('../../../docs/**/*.md', {
  // Bump ?v= when docs HMR outside website/ looks stale on a long-lived Vite process.
  query: '?raw&v=3',
  import: 'default',
  eager: true,
}) as Record<string, string>

function toContentKey(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const marker = '/docs/'
  const idx = normalized.lastIndexOf(marker)
  if (idx >= 0) {
    return normalized.slice(idx + marker.length)
  }
  const alt = normalized.match(/(?:^|\/)docs\/(.+)$/)
  return alt?.[1] ?? path
}

const byKey = new Map<string, string>()
for (const [path, raw] of Object.entries(modules)) {
  const key = toContentKey(path)
  // Skip agent-only docs and the TOC index (nav comes from nav.json).
  if (key.startsWith('AI/') || key === 'toc.md' || key === 'nav.json') {
    continue
  }
  byKey.set(key, raw)
}

export function getDocMarkdown(contentPath: string): string | undefined {
  return byKey.get(contentPath)
}

export function listLoadedDocs(): string[] {
  return [...byKey.keys()].sort()
}
