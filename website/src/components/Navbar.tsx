import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Github, Menu, X } from 'lucide-react'

const navLinks = [
  { name: 'Features', href: '/#features' },
  { name: 'Demos', href: '/demos' },
  { name: 'Tutorials', href: '/tutorials' },
  { name: 'Roadmap', href: '/roadmap' },
  { name: 'Downloads', href: '/downloads' },
  { name: 'Docs', href: '/docs' },
  { name: 'Compare', href: '/compare' },
]

const DESKTOP_MQ = '(min-width: 1024px)'

/**
 * Mobile vs desktop chrome is switched in JS (matchMedia), not via
 * Tailwind `hidden md:flex` or CSS `display:none` breakpoints — Chrome has
 * failed to apply those hide/show patterns on this site before.
 */
export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    return window.matchMedia(DESKTOP_MQ).matches
  })
  const location = useLocation()

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MQ)
    const onChange = () => {
      setIsDesktop(media.matches)
      if (media.matches) {
        setIsOpen(false)
      }
    }
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [location])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const closeMenu = () => setIsOpen(false)

  const nav = (
    <nav
      aria-label="Site"
      style={{ zIndex: 9999 }}
      className="site-nav fixed top-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-b border-border"
      data-mode={isDesktop ? 'desktop' : 'mobile'}
    >
      <div className="site-nav-bar h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/" className="site-nav-brand flex items-center gap-3 shrink-0" onClick={closeMenu}>
          <img src="/logo.svg" alt="" className="w-8 h-8" />
          <span className="text-xl font-bold text-white">Multimeter</span>
        </Link>

        {isDesktop ? (
          <>
            <div className="site-nav-links flex items-center justify-center gap-6">
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

            <div className="site-nav-actions flex items-center justify-end gap-4">
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
          </>
        ) : (
          <button
            type="button"
            className="site-nav-toggle text-slate-300 hover:text-white"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            aria-controls="site-nav-mobile-panel"
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        )}
      </div>

      {!isDesktop && isOpen ? (
        <div
          id="site-nav-mobile-panel"
          className="site-nav-mobile bg-surface-light border-b border-border"
        >
          <div className="px-4 py-4 space-y-3 max-w-7xl mx-auto">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="block text-slate-300 hover:text-white"
                onClick={closeMenu}
              >
                {link.name}
              </Link>
            ))}
            <hr className="border-border" />
            <a
              href="https://github.com/mshobeyri/multimeter"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-300 hover:text-white"
            >
              <Github size={18} />
              GitHub
            </a>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-primary hover:bg-primary-dark text-white text-center px-4 py-2 rounded-lg font-medium"
            >
              Install Extension
            </a>
          </div>
        </div>
      ) : null}
    </nav>
  )

  if (typeof document === 'undefined') {
    return nav
  }
  return createPortal(nav, document.body)
}
