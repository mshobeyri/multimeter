import FadeIn from '../components/FadeIn'
import TestFlowIllustration from '../components/TestFlowIllustration'
import { Workflow } from 'lucide-react'

const BULLETS = [
  'Call APIs, assert results, loop, and branch in YAML',
  'Review paths in a flowchart — edit as code when you need to',
  'Same files in VS Code and CI with testlight',
]

export default function BuiltForVSCode() {
  return (
    <section id="test-flows" className="scroll-mt-20 px-4 sm:px-6 lg:px-8 bg-surface-light/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <FadeIn direction="left">
            <div>
              <span className="text-accent text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Workflow size={16} />
                Test Flows
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
                Reusable flows. Same files everywhere.
              </h2>
              <p className="text-base sm:text-lg text-slate-400 mb-5 leading-relaxed">
                Chain steps into complete API tests — portable{' '}
                <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code>{' '}
                files in Git, ready for VS Code and CI.
              </p>
              <ul className="space-y-3">
                {BULLETS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
                    <span className="text-slate-300 text-sm sm:text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          <FadeIn direction="right" delay={200}>
            <TestFlowIllustration />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
