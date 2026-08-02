import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { docsNav } from '../../docs/nav'

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
                      <li key={item.href}>
                        <NavLink
                          to={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `block rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                              isActive
                                ? 'bg-primary/15 text-primary-light font-medium'
                                : 'text-slate-400 hover:text-white hover:bg-surface-light'
                            }`
                          }
                        >
                          {item.title}
                        </NavLink>
                      </li>
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
