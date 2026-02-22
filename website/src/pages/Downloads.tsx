import { Download, Terminal, ExternalLink, Package } from 'lucide-react'
import FadeIn from '../components/FadeIn'
import FAQ from '../components/FAQ'

export default function Downloads() {
  return (
    <div className="pt-24">
      {/* Hero */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center">
        <FadeIn>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Get <span className="gradient-text">Multimeter</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-2">
            Install the VS Code extension or the CLI tool for CI/CD pipelines
          </p>
          <p className="text-sm text-slate-500">
            Latest Version: <span className="text-white font-medium">1.9.2</span>
          </p>
        </FadeIn>
      </section>

      {/* Install options */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* VS Code Extension */}
          <FadeIn delay={100}>
            <div className="bg-surface-light border border-border rounded-2xl p-8 h-full flex flex-col">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Download size={28} className="text-primary-light" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                VS Code Extension
              </h2>
              <p className="text-slate-400 mb-6 flex-1">
                The full Multimeter experience — custom editor, UI panels, mock server,
                environment manager, test history, AI assistant, and more.
              </p>

              {/* Install methods */}
              <div className="space-y-4">
                <a
                  href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-semibold transition-colors w-full"
                >
                  <ExternalLink size={16} />
                  Open in VS Code Marketplace
                </a>

                <div className="text-center text-sm text-slate-500">or</div>

                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">
                    Search in VS Code Extensions:
                  </p>
                  <code className="text-sm text-accent">mshobeyri.multimeter</code>
                </div>

                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">
                    Or install from command line:
                  </p>
                  <code className="text-sm text-slate-300">
                    code --install-extension mshobeyri.multimeter
                  </code>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* CLI */}
          <FadeIn delay={200}>
            <div className="bg-surface-light border border-border rounded-2xl p-8 h-full flex flex-col">
              <div className="w-14 h-14 bg-amber-400/10 rounded-xl flex items-center justify-center mb-6">
                <Terminal size={28} className="text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                CLI Tool — testlight
              </h2>
              <p className="text-slate-400 mb-6 flex-1">
                Run your .mmt tests in CI/CD pipelines, automation scripts, or from the
                terminal. Same test files, same results — everywhere.
              </p>

              {/* Install methods */}
              <div className="space-y-4">
                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Install globally:</p>
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-slate-500 shrink-0" />
                    <code className="text-sm text-slate-300">
                      npm install -g testlight
                    </code>
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Run a test:</p>
                  <code className="text-sm text-slate-300">
                    npx testlight run path/to/test.mmt
                  </code>
                </div>

                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">With environment:</p>
                  <code className="text-sm text-slate-300 text-wrap break-all">
                    npx testlight run test.mmt --env-file .env -e API_URL=https://api.example.com
                  </code>
                </div>

                <a
                  href="https://www.npmjs.com/package/testlight"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-border hover:border-slate-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors w-full hover:bg-surface"
                >
                  <ExternalLink size={16} />
                  View on npm
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* System requirements */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-2xl font-bold text-white text-center mb-8">
              System Requirements
            </h2>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-light border border-border rounded-xl p-6 text-center">
                <p className="text-sm text-slate-500 mb-1">VS Code</p>
                <p className="text-lg font-semibold text-white">≥ 1.95.0</p>
              </div>
              <div className="bg-surface-light border border-border rounded-xl p-6 text-center">
                <p className="text-sm text-slate-500 mb-1">Node.js (for CLI)</p>
                <p className="text-lg font-semibold text-white">≥ 18.x</p>
              </div>
              <div className="bg-surface-light border border-border rounded-xl p-6 text-center">
                <p className="text-sm text-slate-500 mb-1">Platforms</p>
                <p className="text-lg font-semibold text-white">Win / Mac / Linux</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <FAQ />
    </div>
  )
}
