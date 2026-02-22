import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Github, ExternalLink } from 'lucide-react'

const navLinks = [
  { name: 'Features', href: '/#features' },
  { name: 'Demos', href: '/demos' },
  { name: 'Roadmap', href: '/roadmap' },
  { name: 'Downloads', href: '/downloads' },
  {
    name: 'Docs',
    href: 'https://github.com/mshobeyri/multimeter/tree/main/docs',
    external: true,
  },
]

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [location])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-surface/80 backdrop-blur-xl border-b border-border'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logo.svg"
              alt="Multimeter"
              className="w-8 h-8 group-hover:scale-110 transition-transform"
            />
            <span className="text-xl font-bold text-white">Multimeter</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-1"
                >
                  {link.name}
                  <ExternalLink size={12} />
                </a>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-sm text-slate-300 hover:text-white transition-colors"
                >
                  {link.name}
                </Link>
              )
            )}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="https://github.com/mshobeyri/multimeter"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
            >
              <Github size={18} />
              GitHub
            </a>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Install Extension
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-slate-300 hover:text-white"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-surface-light border-b border-border">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-slate-300 hover:text-white transition-colors"
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  className="block text-slate-300 hover:text-white transition-colors"
                >
                  {link.name}
                </Link>
              )
            )}
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
              className="block bg-primary text-white text-center px-4 py-2 rounded-lg font-medium"
            >
              Install Extension
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
