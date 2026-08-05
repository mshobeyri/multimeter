import { docsNav, flattenNavItems } from './nav'
import { getDocMarkdown } from './loadContent'

export type DocsSearchEntry = {
  title: string
  href: string
  section: string
  /** Lowercased haystack for matching (title + path + body). */
  haystack: string
}

function titleFromMarkdown(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim() || fallback
}

function stripMarkdown(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildIndex(): DocsSearchEntry[] {
  const entries: DocsSearchEntry[] = []
  const seen = new Set<string>()

  for (const section of docsNav) {
    for (const leaf of flattenNavItems(section.items)) {
      if (!leaf.href || seen.has(leaf.href)) {
        continue
      }
      seen.add(leaf.href)

      const markdown = leaf.content ? getDocMarkdown(leaf.content) : undefined
      const title = markdown
        ? titleFromMarkdown(markdown, leaf.title)
        : leaf.title
      const body = markdown ? stripMarkdown(markdown) : ''
      const haystack = `${title} ${leaf.title} ${leaf.href} ${body}`.toLowerCase()

      entries.push({
        title,
        href: leaf.href,
        section: section.title,
        haystack,
      })
    }
  }

  return entries
}

const INDEX = buildIndex()

export type DocsSearchHit = DocsSearchEntry & { score: number }

/**
 * Ranked client-side search over docs nav titles and markdown bodies.
 * Title / href hits rank above body-only matches.
 */
export function searchDocs(query: string, limit = 40): DocsSearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    return []
  }
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    return []
  }

  const hits: DocsSearchHit[] = []
  for (const entry of INDEX) {
    let score = 0
    let ok = true
    for (const token of tokens) {
      const titleLower = entry.title.toLowerCase()
      if (titleLower === q || titleLower === token) {
        score += 100
      } else if (titleLower.startsWith(token)) {
        score += 50
      } else if (titleLower.includes(token)) {
        score += 30
      } else if (entry.href.toLowerCase().includes(token)) {
        score += 15
      } else if (entry.haystack.includes(token)) {
        score += 5
      } else {
        ok = false
        break
      }
    }
    if (ok && score > 0) {
      hits.push({ ...entry, score })
    }
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return hits.slice(0, limit)
}
