import FadeIn from '../components/FadeIn'
import { Terminal } from 'lucide-react'

export default function CICDReady() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Terminal mockup — left */}
          <FadeIn direction="left" delay={200}>
            <div className="bg-surface-light border border-border rounded-2xl overflow-hidden">
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
                  <span className="text-slate-300">npm install -g testlight</span>
                </div>
                <div className="text-slate-500">✓ installed testlight@1.9.2</div>
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
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Text — right */}
          <FadeIn direction="right">
            <div>
              <span className="text-amber-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Terminal size={16} />
                CI/CD Ready
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-6">
                Run tests in any pipeline
              </h2>
              <p className="text-lg text-slate-400 mb-6 leading-relaxed">
                The <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">testlight</code> CLI
                runs your exact same <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code> test
                files in CI/CD pipelines. No separate test configuration needed — what you
                test in VS Code is what runs in CI.
              </p>
              <ul className="space-y-4">
                {[
                  'GitHub Actions, Jenkins, GitLab CI, Azure DevOps',
                  'Environment variables via --env-file or -e flags',
                  'Preset switching for dev/staging/production',
                  'Exit codes for pass/fail pipeline gating',
                  'Same YAML files, same results — everywhere',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-slate-300">{item}</span>
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
