import FadeIn from '../components/FadeIn'
import TestFlowIllustration from '../components/TestFlowIllustration'
import { Workflow } from 'lucide-react'

export default function BuiltForVSCode() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-light/30">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <FadeIn direction="left">
            <div>
              <span className="text-accent text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Workflow size={16} />
                Test Flows
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-6">
                Reusable test flows
                <br />
                that run everywhere
              </h2>
              <p className="text-lg text-slate-400 mb-6 leading-relaxed">
                Chain API calls, assertions, loops, and delays into complete
                test flows. Write them in YAML or build them visually with
                drag-and-drop — either way you get portable <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code> files
                that run inside VS Code, in CI pipelines with <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">testlight</code>,
                or anywhere Node runs.
              </p>
              <ul className="space-y-4">
                {[
                  'Compose flows from reusable API definitions — call, assert, loop, branch',
                  'Import other tests and CSV data to build complex scenarios',
                  'Run locally in VS Code or in CI/CD with a single CLI command',
                  'Simpler than JMeter or Postman Runner — no GUI required in pipelines',
                  'Plain YAML files live in your repo, versioned and reviewed like code',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          {/* Interactive flow demo */}
          <FadeIn direction="right" delay={200}>
            <TestFlowIllustration />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
