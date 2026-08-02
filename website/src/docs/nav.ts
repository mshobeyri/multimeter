import navJson from '../../../docs/nav.json'

export type DocsNavItem = {
  title: string
  href: string
  /** Relative path under repo docs/ (no leading slash). Omit for special pages. */
  content?: string
}

export type DocsNavSection = {
  title: string
  items: DocsNavItem[]
}

function pathToHref(contentPath: string): string {
  const withoutExt = contentPath.replace(/\.md$/, '')
  if (withoutExt === 'tasks/index') {
    return '/docs/tasks'
  }
  if (withoutExt.endsWith('/index')) {
    return `/docs/${withoutExt.slice(0, -'/index'.length)}`
  }
  return `/docs/${withoutExt}`
}

export const docsNav: DocsNavSection[] = (navJson as Array<{
  title: string
  items: Array<{ title: string; path?: string; href?: string }>
}>).map((section) => ({
  title: section.title,
  items: section.items.map((item) => {
    if (item.href) {
      return { title: item.title, href: item.href }
    }
    const content = item.path as string
    return {
      title: item.title,
      href: pathToHref(content),
      content,
    }
  }),
}))

export function findNavItem(pathname: string): DocsNavItem | undefined {
  const normalized = pathname.replace(/\/$/, '') || '/docs'
  for (const section of docsNav) {
    for (const item of section.items) {
      if (item.href === normalized) {
        return item
      }
    }
  }
  return undefined
}

export function allContentPaths(): string[] {
  return docsNav.flatMap((section) =>
    section.items.filter((item) => item.content).map((item) => item.content as string),
  )
}
