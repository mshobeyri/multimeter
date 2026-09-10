/**
 * Nested docs nav helpers shared by nav.ts and DocsLayout.
 */
export type DocsNavLeaf = {
  title: string
  href: string
  content?: string
  /** Codicon name without `codicon-` prefix */
  icon?: string
}

export type DocsNavGroup = {
  title: string
  href?: string
  content?: string
  icon?: string
  children: DocsNavEntry[]
}

export type DocsNavEntry = DocsNavLeaf | DocsNavGroup

export type DocsNavSection = {
  title: string
  items: DocsNavEntry[]
}

export function isNavGroup(item: DocsNavEntry): item is DocsNavGroup {
  return Array.isArray((item as DocsNavGroup).children)
}

export function pathToHref(contentPath: string): string {
  const withoutExt = contentPath.replace(/\.md$/, '')
  if (withoutExt === 'tasks/index') {
    return '/docs/tasks'
  }
  if (withoutExt.endsWith('/index')) {
    return `/docs/${withoutExt.slice(0, -'/index'.length)}`
  }
  return `/docs/${withoutExt}`
}

export function normalizeDocsPath(pathname: string): string {
  const path = (pathname || '').split('#')[0].split('?')[0]
  const trimmed = path.replace(/\/+$/, '')
  return trimmed || '/'
}

/** Exact current-page match for the left docs nav (plus example detail pages). */
export function isDocsNavHrefActive(href: string, pathname: string): boolean {
  const current = normalizeDocsPath(pathname)
  const target = normalizeDocsPath(href)
  if (current === target) {
    return true
  }
  if (target === '/docs/examples' && current.startsWith('/docs/examples/')) {
    return true
  }
  return false
}

export function docsNavGroupContainsPath(
  children: DocsNavEntry[], pathname: string): boolean {
  return flattenNavItems(children).some(
      (leaf) => isDocsNavHrefActive(leaf.href, pathname))
}

/**
 * Deepest nav nesting that matches the current URL. Duplicate hrefs (e.g. a
 * top-level Panels shortcut and the same page under MMT Files) should only
 * highlight the nested item.
 */
export function maxMatchingNavDepth(
  sections: DocsNavSection[],
  pathname: string,
): number {
  let max = -1
  for (const section of sections) {
    max = Math.max(max, matchingNavDepth(section.items, pathname, 0))
  }
  return max
}

function matchingNavDepth(
  items: DocsNavEntry[],
  pathname: string,
  depth: number,
): number {
  let max = -1
  for (const item of items) {
    if (isNavGroup(item)) {
      if (item.href && isDocsNavHrefActive(item.href, pathname)) {
        max = Math.max(max, depth)
      }
      max = Math.max(max, matchingNavDepth(item.children, pathname, depth + 1))
    } else if (isDocsNavHrefActive(item.href, pathname)) {
      max = Math.max(max, depth)
    }
  }
  return max
}

export function isDocsNavHrefSelected(
  href: string,
  pathname: string,
  depth: number,
  maxMatchDepth: number,
): boolean {
  if (!isDocsNavHrefActive(href, pathname)) {
    return false
  }
  return depth === maxMatchDepth
}

export function flattenNavItems(items: DocsNavEntry[]): DocsNavLeaf[] {
  const out: DocsNavLeaf[] = []
  for (const item of items) {
    if (isNavGroup(item)) {
      if (item.href) {
        out.push({
          title: item.title,
          href: item.href,
          content: item.content,
          icon: item.icon,
        })
      }
      out.push(...flattenNavItems(item.children))
    } else {
      out.push(item)
    }
  }
  return out
}
