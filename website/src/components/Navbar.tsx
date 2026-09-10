import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Github } from 'lucide-react'

const navLinks = [
  { name: 'Features', href: '/#features' },
  { name: 'Demos', href: '/demos' },
  { name: 'Tutorials', href: '/tutorials' },
  { name: 'Roadmap', href: '/roadmap' },
  { name: 'Downloads', href: '/downloads' },
  { name: 'Docs', href: '/docs' },
  { name: 'Compare', href: '/compare' },
]

export default function Navbar() {
  const nav = (
    <nav
      aria-label="Site"
      style={{ zIndex: 9999 }}
      className="fixed top-0 left-0 right-0 h-16 bg-surface/95 backdrop-blur-xl border-b border-border"
    >
      <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <Link to="/" className="flex items-center gap-3 justify-self-start shrink-0">
          <img src="/logo.svg" alt="" className="w-8 h-8" />
          <span className="text-xl font-bold text-white">Multimeter</span>
        </Link>

        <div className="flex items-center justify-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="text-sm text-slate-300 hover:text-white whitespace-nowrap"
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-end gap-4 justify-self-end">
          <a
            href="https://github.com/mshobeyri/multimeter"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            <Github size={18} />
            GitHub
          </a>
          <a
            href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
          >
            Install Extension
          </a>
        </div>
      </div>
    </nav>
  )

  if (typeof document === 'undefined') {
    return nav
  }
  return createPortal(nav, document.body)
}
