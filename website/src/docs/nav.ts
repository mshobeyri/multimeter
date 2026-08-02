import navJson from '../../../docs/nav.json'
import {
  flattenNavItems,
  pathToHref,
  type DocsNavEntry,
  type DocsNavSection,
  type DocsNavLeaf,
} from './navTypes'

export type { DocsNavEntry, DocsNavLeaf, DocsNavSection } from './navTypes'
export { isNavGroup, flattenNavItems, pathToHref } from './navTypes'

type JsonItem = {
  title: string
  path?: string
  href?: string
  children?: JsonItem[]
}

function mapItem(item: JsonItem): DocsNavEntry {
  if (item.children && item.children.length > 0) {
    const children = item.children.map((child) => {
      if (child.href) {
        return { title: child.title, href: child.href }
      }
      const content = child.path as string
      return { title: child.title, href: pathToHref(content), content }
    })
    const group: DocsNavEntry = {
      title: item.title,
      children,
    }
    if (item.href) {
      ;(group as { href?: string }).href = item.href
    } else if (item.path) {
      ;(group as { href?: string; content?: string }).href = pathToHref(item.path)
      ;(group as { content?: string }).content = item.path
    }
    return group
  }
  if (item.href) {
    return { title: item.title, href: item.href }
  }
  const content = item.path as string
  return { title: item.title, href: pathToHref(content), content }
}

export const docsNav: DocsNavSection[] = (
  navJson as Array<{ title: string; items: JsonItem[] }>
).map((section) => ({
  title: section.title,
  items: section.items.map(mapItem),
}))

export function findNavItem(pathname: string): DocsNavLeaf | undefined {
  const normalized = pathname.replace(/\/$/, '') || '/docs'
  for (const section of docsNav) {
    for (const leaf of flattenNavItems(section.items)) {
      if (leaf.href === normalized) {
        return leaf
      }
    }
  }
  return undefined
}

export function allContentPaths(): string[] {
  return docsNav.flatMap((section) =>
    flattenNavItems(section.items)
      .filter((item) => item.content)
      .map((item) => item.content as string),
  )
}
