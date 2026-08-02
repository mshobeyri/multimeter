import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { docsNav, flattenNavItems, isNavGroup } from '../../docs/nav'
import type { DocsNavEntry } from '../../docs/nav'
import Codicon from '../../components/Codicon'

function NavLabel({ title, icon }: { title: string; icon?: string }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {icon ? <Codicon name={icon} className="docs-nav-icon shrink-0" /> : null}
      <span className="truncate">{title}</span>
    </span>
  )
}

function NavItemLink({
  href,
  title,
  icon,
  onNavigate,
  nested,
}: {
  href: string
  title: string
  icon?: string
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
      <NavLabel title={title} icon={icon} />
    </NavLink>
  )
}

function NavEntry({
  item,
  onNavigate,
  nested = false,
}: {
  item: DocsNavEntry
  onNavigate: () => void
  nested?: boolean
}) {
  const location = useLocation()
  const path = location.pathname.replace(/\/$/, '')

  if (!isNavGroup(item)) {
    return (
      <li>
        <NavItemLink
          href={item.href}
          title={item.title}
          icon={item.icon}
          onNavigate={onNavigate}
          nested={nested}
        />
      </li>
    )
  }

  const childActive = flattenNavItems(item.children).some((c) => c.href === path)
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
              `flex-1 min-w-0 block rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                nested ? 'pl-4' : ''
              } ${
                isActive
                  ? 'bg-primary/15 text-primary-light font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-surface-light'
              }`
            }
          >
            <NavLabel title={item.title} icon={item.icon} />
          </NavLink>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex-1 min-w-0 text-left rounded-md px-2.5 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-surface-light ${
              nested ? 'pl-4' : ''
            }`}
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
            />
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
