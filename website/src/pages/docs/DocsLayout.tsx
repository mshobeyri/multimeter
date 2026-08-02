import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { docsNav, isNavGroup } from '../../docs/nav'
import type { DocsNavEntry } from '../../docs/nav'

function NavItemLink({
  href,
  title,
  onNavigate,
  nested,
}: {
  href: string
  title: string
  onNavigate: () => void
  nested?: boolean
}) {
  return (
    <NavLink
      to={href}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        `block rounded-md px-2.5 py-1.5 text-sm transition-colors ${
          nested ? 'pl-4' : ''
        } ${
          isActive
            ? 'bg-primary/15 text-primary-light font-medium'
            : 'text-slate-400 hover:text-white hover:bg-surface-light'
        }`
      }
    >
      {title}
    </NavLink>
  )
}

function NavEntry({
  item,
  onNavigate,
}: {
  item: DocsNavEntry
  onNavigate: () => void
}) {
  const location = useLocation()
  const path = location.pathname.replace(/\/$/, '')

  if (!isNavGroup(item)) {
    return (
      <li>
        <NavItemLink href={item.href} title={item.title} onNavigate={onNavigate} />
      </li>
    )
  }

  const childActive = item.children.some((c) => c.href === path)
  const selfActive = item.href === path
  const [open, setOpen] = useState(childActive || selfActive)

  return (
    <li>
      <div className="flex items-center gap-0.5">
        {item.href ? (
          <NavLink
            to={item.href}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex-1 block rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                isActive
                  ? 'bg-primary/15 text-primary-light font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-surface-light'
              }`
            }
          >
            {item.title}
          </NavLink>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex-1 text-left rounded-md px-2.5 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-surface-light"
          >
            {item.title}
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
        <ul className="mt-0.5 space-y-0.5 border-l border-border ml-3">
          {item.children.map((child) => (
            <li key={child.href}>
              <NavItemLink
                href={child.href}
                title={child.title}
                onNavigate={onNavigate}
                nested
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export default function DocsLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

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
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1" key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
