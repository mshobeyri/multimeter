import { Link } from 'react-router-dom'
import { Github, Linkedin, Mail, Youtube } from 'lucide-react'

type FooterLink = { name: string; href: string; external?: boolean }

const footerLinks: Record<string, FooterLink[]> = {
  Product: [
    { name: 'Features', href: '/#features' },
    { name: 'Test Flows', href: '/#test-flows' },
    { name: 'Protocols', href: '/#protocols' },
    { name: 'Mock Server', href: '/#mock-server' },
    { name: 'Comparison', href: '/#comparison' },
    { name: 'Downloads', href: '/downloads' },
    { name: 'Demos', href: '/demos' },
    { name: 'CLI (testlight)', href: 'https://www.npmjs.com/package/testlight', external: true },
  ],
  Resources: [
    { name: 'Git-Native Files', href: '/#git-native' },
    { name: 'AI Test Generation', href: '/#ai-test-generation' },
    { name: 'CI/CD', href: '/#ci-cd' },
    { name: 'Website Documentation', href: '/#documentation' },
    { name: 'FAQ', href: '/#faq' },
    { name: 'Documentation', href: '/docs' },
    { name: 'Install', href: '/docs/install' },
    { name: 'MMT Files', href: '/docs/files' },
    { name: 'Examples', href: '/docs/examples' },
    { name: 'API reference', href: '/docs/files/api' },
    { name: 'Test reference', href: '/docs/files/test' },
    { name: 'Test Server', href: '/test-server' },
  ],
  Community: [
    { name: 'GitHub', href: 'https://github.com/mshobeyri/multimeter', external: true },
    { name: 'YouTube (@mmt_dev)', href: 'https://www.youtube.com/@mmt_dev', external: true },
    { name: 'VS Code Marketplace', href: 'https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter', external: true },
    { name: 'Report Issue', href: 'https://github.com/mshobeyri/multimeter/issues', external: true },
    { name: 'Request Feature', href: 'https://github.com/mshobeyri/multimeter/issues/new', external: true },
  ],
  Legal: [
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Privacy Policy', href: '/privacy' },
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
              Functional, Automation And Performance Testing. All as code...
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
                href="https://www.linkedin.com/company/multimetertest"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="https://www.youtube.com/@mmt_dev"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <Youtube size={20} />
              </a>
              <a
                href="mailto:support@mmt.dev"
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
          
          </p>
        </div>
      </div>
    </footer>
  )
}
