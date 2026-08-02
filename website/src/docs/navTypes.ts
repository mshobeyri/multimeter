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
