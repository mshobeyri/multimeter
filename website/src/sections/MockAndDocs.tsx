import FadeIn from '../components/FadeIn'
import { FileText, Server } from 'lucide-react'

const MOCK_BULLETS = [
  'Routes, status codes, and dynamic responses in YAML',
  'Reflect mode and template variables — no extra tools',
  'Start from suites, tests, or the VS Code panel',
]

const DOC_BULLETS = [
  'Generated from the same .mmt API files you already write',
  'Interactive examples with dark and light themes',
  'Export HTML or Markdown when you need to share',
]

export default function MockAndDocs() {
  return (
    <section className="scroll-mt-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-0">
          <FadeIn direction="left">
            <div id="mock-server" className="scroll-mt-20 lg:pr-10 xl:pr-14">
              <span className="text-pink-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Server size={16} />
                Mock Server
              </span>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white mt-3 mb-3">
                Mock APIs in YAML
              </h2>
              <p className="text-sm sm:text-base text-slate-400 mb-4 leading-relaxed">
                HTTP and WebSocket mocks from{' '}
                <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code>{' '}
                files — start in milliseconds, stay in Git.
              </p>
              <ul className="space-y-2.5">
                {MOCK_BULLETS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />
                    <span className="text-slate-400 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          <FadeIn direction="right" delay={200}>
            <div
              id="documentation"
              className="scroll-mt-20 lg:pl-10 xl:pl-14 lg:border-l lg:border-border/50 pt-10 lg:pt-0"
            >
              <span className="text-sky-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} />
                API Documentation
              </span>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white mt-3 mb-3">
                Docs that never go stale.
              </h2>
              <p className="text-sm sm:text-base text-slate-400 mb-4 leading-relaxed">
                Generate polished API docs from the same{' '}
                <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code>{' '}
                files you already maintain — no separate doc repo, no copy-paste drift.
              </p>
              <ul className="space-y-2.5">
                {DOC_BULLETS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                    <span className="text-slate-400 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
