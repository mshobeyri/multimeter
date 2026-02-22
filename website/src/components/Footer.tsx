import { Link } from 'react-router-dom'
import { Github, Twitter, Mail } from 'lucide-react'

const footerLinks = {
  Product: [
    { name: 'Features', href: '/#features' },
    { name: 'Downloads', href: '/downloads' },
    { name: 'Demos', href: '/demos' },
    { name: 'CLI (testlight)', href: 'https://www.npmjs.com/package/testlight', external: true },
  ],
  Resources: [
    { name: 'Documentation', href: 'https://github.com/mshobeyri/multimeter/tree/main/docs', external: true },
    { name: 'API Testing Guide', href: 'https://github.com/mshobeyri/multimeter/blob/main/docs/api-mmt.md', external: true },
    { name: 'Test Flow Guide', href: 'https://github.com/mshobeyri/multimeter/blob/main/docs/test-mmt.md', external: true },
    { name: 'MMT Overview', href: 'https://github.com/mshobeyri/multimeter/blob/main/docs/mmt-overview.md', external: true },
  ],
  Community: [
    { name: 'GitHub', href: 'https://github.com/mshobeyri/multimeter', external: true },
    { name: 'VS Code Marketplace', href: 'https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter', external: true },
    { name: 'Report Issue', href: 'https://github.com/mshobeyri/multimeter/issues', external: true },
    { name: 'Request Feature', href: 'https://github.com/mshobeyri/multimeter/issues/new', external: true },
  ],
  Legal: [
    { name: 'Terms of Service', href: '/terms', external: false },
    { name: 'Privacy Policy', href: '/privacy', external: false },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Top section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <img src="/logo.svg" alt="Multimeter" className="w-8 h-8" />
              <span className="text-xl font-bold text-white">Multimeter</span>
            </Link>
            <p className="text-sm text-slate-400 mb-6">
              All possible tests for your service — as code. API testing for VS Code.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/mshobeyri/multimeter"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <Github size={20} />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <Twitter size={20} />
              </a>
              <a
                href="mailto:support@multimeter.dev"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <Mail size={20} />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                {title}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        {link.name}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        {link.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Multimeter. All rights reserved.
          </p>
          <p className="text-sm text-slate-500">
            Made with ❤️ for developers everywhere
          </p>
        </div>
      </div>
    </footer>
  )
}
