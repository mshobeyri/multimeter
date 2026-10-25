import type { ReactNode } from 'react'
import FadeIn from '../components/FadeIn'
import { FileText, Server, Terminal, Workflow } from 'lucide-react'

type Cell = {
  id: string
  eyebrow: string
  eyebrowClass: string
  icon: ReactNode
  title: string
  description: ReactNode
  bullets: string[]
  bulletClass: string
}

const CELLS: Cell[] = [
  {
    id: 'mock-server',
    eyebrow: 'Mock Server',
    eyebrowClass: 'text-pink-400',
    icon: <Server size={16} />,
    title: 'Mock APIs in YAML',
    description: (
      <>
        HTTP and WebSocket mocks from{' '}
        <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code>{' '}
        files — start in milliseconds, stay in Git.
      </>
    ),
    bullets: [
      'Routes, status codes, and dynamic responses in YAML',
      'Reflect mode and template variables — no extra tools',
      'Start from suites, tests, or the VS Code panel',
    ],
    bulletClass: 'bg-pink-400',
  },
  {
    id: 'documentation',
    eyebrow: 'API Documentation',
    eyebrowClass: 'text-sky-400',
    icon: <FileText size={16} />,
    title: 'Docs that never go stale.',
    description: (
      <>
        Generate polished API docs from the same{' '}
        <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code>{' '}
        files you already maintain — no separate doc repo, no copy-paste drift.
      </>
    ),
    bullets: [
      'Generated from the same .mmt API files you already write',
      'Interactive examples with dark and light themes',
      'Export HTML or Markdown when you need to share',
    ],
    bulletClass: 'bg-sky-400',
  },
  {
    id: 'test-flows',
    eyebrow: 'Test Flows',
    eyebrowClass: 'text-[#facc15]',
    icon: <Workflow size={16} />,
    title: 'Reusable flows. Same files everywhere.',
    description: (
      <>
        Chain steps into complete API tests — portable{' '}
        <code className="text-[#facc15] bg-[#facc15]/10 px-1.5 py-0.5 rounded text-sm">.mmt</code>{' '}
        files in Git, ready for VS Code and CI.
      </>
    ),
    bullets: [
      'Call APIs, assert results, loop, and branch in YAML',
      'Review paths in a flowchart — edit as code when you need to',
      'Same files in VS Code and CI with testlight',
    ],
    bulletClass: 'bg-[#facc15]',
  },
  {
    id: 'ci-cd',
    eyebrow: 'CI/CD Ready',
    eyebrowClass: 'text-green-400',
    icon: <Terminal size={16} />,
    title: 'Same tests. Any pipeline.',
    description: (
      <>
        <code className="text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded text-sm">testlight</code>{' '}
        runs the same{' '}
        <code className="text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded text-sm">.mmt</code>{' '}
        files you edit in VS Code — no duplicate config.
      </>
    ),
    bullets: [
      'GitHub Actions, GitLab CI, Jenkins, and Azure DevOps',
      'JUnit XML and HTML reports for pipeline gates',
      'Env files and presets for dev, staging, and production',
    ],
    bulletClass: 'bg-green-400',
  },
]

function FeatureCell({ cell }: { cell: Cell }) {
  return (
    <div id={cell.id} className="scroll-mt-24">
      <span
        className={`${cell.eyebrowClass} text-sm font-semibold uppercase tracking-wider flex items-center gap-2`}
      >
        {cell.icon}
        {cell.eyebrow}
      </span>
      <h2 className="text-2xl sm:text-3xl font-semibold text-white mt-3 mb-3">{cell.title}</h2>
      <p className="text-sm sm:text-base text-slate-400 mb-4 leading-relaxed">{cell.description}</p>
      <ul className="space-y-2.5">
        {cell.bullets.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${cell.bulletClass} shrink-0`} />
            <span className="text-slate-400 text-sm">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MockAndDocs() {
  return (
    <section className="scroll-mt-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-12 lg:gap-x-14 lg:gap-y-14">
            {CELLS.map((cell) => (
              <FeatureCell key={cell.id} cell={cell} />
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
