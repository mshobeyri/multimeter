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
  icon?: string
  children?: JsonItem[]
}

function mapLeaf(item: JsonItem): DocsNavLeaf {
  if (item.href) {
    return { title: item.title, href: item.href, icon: item.icon }
  }
  const content = item.path as string
  return { title: item.title, href: pathToHref(content), content, icon: item.icon }
}

function mapItem(item: JsonItem): DocsNavEntry {
  if (item.children && item.children.length > 0) {
    const children = item.children.map(mapItem)
    const group: DocsNavGroupWithOptional = {
      title: item.title,
      children,
      icon: item.icon,
    }
    if (item.href) {
      group.href = item.href
    } else if (item.path) {
      group.href = pathToHref(item.path)
      group.content = item.path
    }
    return group
  }
  return mapLeaf(item)
}

type DocsNavGroupWithOptional = {
  title: string
  href?: string
  content?: string
  icon?: string
  children: DocsNavEntry[]
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
