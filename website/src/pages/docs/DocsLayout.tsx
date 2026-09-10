import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import {
  docsNav,
  docsNavGroupContainsPath,
  isDocsNavHrefSelected,
  isNavGroup,
  maxMatchingNavDepth,
} from '../../docs/nav'
import type { DocsNavEntry } from '../../docs/nav'
import Codicon from '../../components/Codicon'
import DocsSearch from './DocsSearch'

const NAV_LINK_IDLE =
  'text-slate-400 hover:text-white hover:bg-surface-light'
const NAV_LINK_ACTIVE =
  'bg-primary/25 text-white font-semibold ring-1 ring-inset ring-primary/50'

function NavLabel({ title, icon }: { title: string; icon?: string }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {icon ? <Codicon name={icon} className="docs-nav-icon shrink-0" /> : null}
      <span className="truncate">{title}</span>
    </span>
  )
}

function navLinkClass(active: boolean, nested?: boolean): string {
  return [
    'block rounded-md px-2.5 py-1.5 text-sm transition-colors',
    nested ? 'pl-4' : '',
    active ? NAV_LINK_ACTIVE : NAV_LINK_IDLE,
  ].filter(Boolean).join(' ')
}

function NavItemLink({
  href,
  title,
  icon,
  onNavigate,
  nested,
  depth,
  maxMatchDepth,
}: {
  href: string
  title: string
  icon?: string
  onNavigate: () => void
  nested?: boolean
  depth: number
  maxMatchDepth: number
}) {
  const location = useLocation()
  const active = isDocsNavHrefSelected(
    href,
    location.pathname,
    depth,
    maxMatchDepth,
  )
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [active, href])

  return (
    <NavLink
      ref={ref}
      to={href}
      end
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={navLinkClass(active, nested)}
    >
      <NavLabel title={title} icon={icon} />
    </NavLink>
  )
}

function NavEntry({
  item,
  onNavigate,
  nested = false,
  depth = 0,
  maxMatchDepth,
}: {
  item: DocsNavEntry
  onNavigate: () => void
  nested?: boolean
  depth?: number
  maxMatchDepth: number
}) {
  const location = useLocation()
  const path = location.pathname

  if (!isNavGroup(item)) {
    return (
      <li>
        <NavItemLink
          href={item.href}
          title={item.title}
          icon={item.icon}
          onNavigate={onNavigate}
          nested={nested}
          depth={depth}
          maxMatchDepth={maxMatchDepth}
        />
      </li>
    )
  }

  const selfActive = Boolean(
    item.href &&
      isDocsNavHrefSelected(item.href, path, depth, maxMatchDepth),
  )
  const childActive = docsNavGroupContainsPath(item.children, path)
  const pathInGroup = selfActive || childActive
  const [open, setOpen] = useState(pathInGroup)

  useEffect(() => {
    if (pathInGroup) {
      setOpen(true)
    }
  }, [pathInGroup])

  return (
    <li>
      <div className="flex items-center gap-0.5">
        {item.href ? (
          <NavLink
            to={item.href}
            end
            onClick={onNavigate}
            aria-current={selfActive ? 'page' : undefined}
            className={`flex-1 min-w-0 ${navLinkClass(selfActive, nested)}`}
          >
            <NavLabel title={item.title} icon={item.icon} />
          </NavLink>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex-1 min-w-0 text-left ${navLinkClass(false, nested)}`}
          >
            <NavLabel title={item.title} icon={item.icon} />
          </button>
        )}
        <button
          type="button"
          aria-label={open ? 'Collapse' : 'Expand'}
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 rounded text-slate-500 hover:text-white"
        >
          <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
      </div>
      {open ? (
        <ul className={`mt-0.5 space-y-0.5 border-l border-border ${nested ? 'ml-6' : 'ml-3'}`}>
          {item.children.map((child) => (
            <NavEntry
              key={isNavGroup(child) ? child.title : child.href}
              item={child}
              onNavigate={onNavigate}
              nested
              depth={depth + 1}
              maxMatchDepth={maxMatchDepth}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export default function DocsLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const location = useLocation()
  const maxMatchDepth = useMemo(
    () => maxMatchingNavDepth(docsNav, location.pathname),
    [location.pathname],
  )

  return (
    <div className="pt-16 min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden py-3 border-b border-border">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            Docs menu
          </button>
        </div>

        <div className="flex gap-8 lg:gap-10 py-6 lg:py-10">
          <aside
            className={`${
              mobileOpen ? 'block' : 'hidden'
            } lg:block w-full lg:w-60 shrink-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto`}
          >
            <DocsSearch
              onNavigate={() => setMobileOpen(false)}
              onSearchingChange={setSearching}
            />
            {!searching ? (
              <nav className="space-y-6 pb-8" aria-label="Docs">
                {docsNav.map((section) => (
                  <div key={section.title}>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      {section.title}
                    </h2>
                    <ul className="space-y-0.5">
                      {section.items.map((item) => (
                        <NavEntry
                          key={isNavGroup(item) ? item.title : item.href}
                          item={item}
                          onNavigate={() => setMobileOpen(false)}
                          maxMatchDepth={maxMatchDepth}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            ) : null}
          </aside>

          <div className="min-w-0 flex-1" key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
