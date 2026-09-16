import FadeIn from '../components/FadeIn'
import { Terminal } from 'lucide-react'

const BULLETS = [
  'GitHub Actions, GitLab CI, Jenkins, and Azure DevOps',
  'JUnit XML and HTML reports for pipeline gates',
  'Env files and presets for dev, staging, and production',
]

export default function CICDReady() {
  return (
    <section id="ci-cd" className="scroll-mt-20 px-4 sm:px-6 lg:px-8 bg-surface-light/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Terminal mockup — left */}
          <FadeIn direction="left" delay={200}>
            <div className="bg-surface-light border border-emerald-500/20 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(34,197,94,0.12)]">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="ml-2 text-xs text-slate-500">terminal</span>
              </div>
              {/* Terminal body */}
              <div className="p-6 font-mono text-sm space-y-3">
                <div>
                  <span className="text-green-400">$</span>{' '}
                  <span className="text-slate-300">npm install -g mmt-testlight</span>
                </div>
                <div className="text-slate-500">✓ installed mmt-testlight</div>
                <div className="mt-4">
                  <span className="text-green-400">$</span>{' '}
                  <span className="text-slate-300">
                    npx testlight run tests/smoke-suite.mmt
                  </span>
                </div>
                <div className="text-slate-500">
                  <div>Running suite: smoke-suite</div>
                  <div className="text-green-400">  ✓ login-test (342ms)</div>
                  <div className="text-green-400">  ✓ get-users-test (128ms)</div>
                  <div className="text-green-400">  ✓ create-order-test (256ms)</div>
                  <div className="text-green-400">  ✓ websocket-test (89ms)</div>
                  <div className="mt-2">
                    <span className="text-green-400">4 passed</span>
                    <span className="text-slate-500"> | 0 failed | 815ms</span>
                  </div>
                  <div className="mt-2 text-green-400">✓ Report written: reports/results.xml</div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Text — right */}
          <FadeIn direction="right">
            <div>
              <span className="text-green-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Terminal size={16} />
                CI/CD Ready
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
                Same tests. Any pipeline.
              </h2>
              <p className="text-base sm:text-lg text-slate-400 mb-5 leading-relaxed">
                <code className="text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded text-sm">testlight</code>{' '}
                runs the same{' '}
                <code className="text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded text-sm">.mmt</code>{' '}
                files you edit in VS Code — no duplicate config.
              </p>
              <ul className="space-y-3">
                {BULLETS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-green-400 shrink-0" />
                    <span className="text-slate-300 text-sm sm:text-base">{item}</span>
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
