import { useState, useEffect } from 'react'
import { ExternalLink, Package } from 'lucide-react'
import FadeIn from '../components/FadeIn'
import FAQ from '../components/FAQ'

function useVscodeVersion() {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;api-version=6.0-preview.1',
      },
      body: JSON.stringify({
        filters: [{ criteria: [{ filterType: 7, value: 'mshobeyri.multimeter' }] }],
        flags: 0x1,
      }),
    })
      .then(r => r.json())
      .then(data => {
        const ext = data?.results?.[0]?.extensions?.[0]
        if (ext?.versions?.[0]?.version) {
          setVersion(ext.versions[0].version)
        }
      })
      .catch(() => {})
  }, [])
  return version
}

function useNpmVersion() {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    fetch('https://registry.npmjs.org/mmt-testlight/latest')
      .then(r => r.json())
      .then(data => {
        if (data?.version) {
          setVersion(data.version)
        }
      })
      .catch(() => {})
  }, [])
  return version
}

function VSCodeLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <mask id="a" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
        <path fillRule="evenodd" clipRule="evenodd" d="M181.534 254.252a15.934 15.934 0 0 0 12.7-.488l52.706-25.361a16.002 16.002 0 0 0 9.06-14.42V42.018a16 16 0 0 0-9.06-14.42L194.233 2.236a15.939 15.939 0 0 0-18.185 3.3l-100.9 92.052L33.6 64.07a10.665 10.665 0 0 0-13.626.975L2.467 81.03a10.668 10.668 0 0 0-.005 15.931L41.243 128 2.462 159.039a10.668 10.668 0 0 0 .005 15.931l17.507 15.986a10.665 10.665 0 0 0 13.626.975l41.548-33.518 100.9 92.052a15.912 15.912 0 0 0 5.486 3.787ZM192.001 69.39 115.456 128l76.545 58.61V69.39Z" fill="#fff"/>
      </mask>
      <g mask="url(#a)">
        <path d="M246.94 27.638 194.193 2.241a15.947 15.947 0 0 0-18.194 3.3L2.453 159.039a10.667 10.667 0 0 0 .005 15.931l17.511 15.986a10.667 10.667 0 0 0 13.625.975L237.054 18.2a10.666 10.666 0 0 1 16.946 8.63v-1.205a16 16 0 0 0-7.06-7.988Z" fill="#0065A9"/>
        <path d="M246.94 228.362 194.193 253.76a15.946 15.946 0 0 1-18.194-3.3L2.453 96.961A10.667 10.667 0 0 1 2.458 81.03l17.511-15.986a10.666 10.666 0 0 1 13.625-.975l203.46 173.731a10.667 10.667 0 0 0 16.946-8.63v1.205a16.001 16.001 0 0 1-7.06 7.987Z" fill="#007ACC"/>
        <path d="M194.196 253.763A15.955 15.955 0 0 1 176 250.461c5.9 5.9 16 1.722 16-6.627V12.166c0-8.349-10.1-12.528-16-6.627a15.955 15.955 0 0 1 18.196-3.302l52.746 25.399A16 16 0 0 1 256 42.056v171.888a16 16 0 0 1-9.058 14.42l-52.746 25.399Z" fill="#1F9CF0"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M181.378 254.252a15.936 15.936 0 0 0 12.699-.488l52.706-25.361a16 16 0 0 0 9.061-14.42V42.018a16.002 16.002 0 0 0-9.061-14.42L194.077 2.236a15.939 15.939 0 0 0-18.185 3.3l-100.9 92.052-41.548-33.518a10.667 10.667 0 0 0-13.626.975L2.311 81.03a10.668 10.668 0 0 0-.005 15.931L41.087 128 2.306 159.039a10.668 10.668 0 0 0 .005 15.931l17.507 15.986a10.665 10.665 0 0 0 13.626.975l41.548-33.518 100.9 92.052a15.906 15.906 0 0 0 5.486 3.787ZM191.845 69.39 115.3 128l76.545 58.61V69.39Z" fill="url(#b)" opacity=".25"/>
      </g>
      <defs>
        <linearGradient id="b" x1="127.844" y1="0.66" x2="127.844" y2="255.34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff"/>
          <stop offset="1" stopColor="#fff" stopOpacity="0"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function NpmLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path d="M0 256V0h256v256z" fill="#C12127"/>
      <path d="M48 48h160v160h-32V80h-48v128H48z" fill="#fff"/>
    </svg>
  )
}

export default function Downloads() {
  const vscodeVersion = useVscodeVersion()
  const npmVersion = useNpmVersion()

  return (
    <div className="pt-24">
      {/* Hero */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center">
        <FadeIn>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Get <span className="gradient-text">Multimeter</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Install the VS Code extension or the CLI tool for CI/CD pipelines
          </p>
        </FadeIn>
      </section>

      {/* Install options */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* VS Code Extension */}
          <FadeIn delay={100}>
            <div className="bg-surface-light border border-border rounded-2xl p-8 h-full flex flex-col">
              <div className="w-14 h-14 bg-[#007ACC]/10 rounded-xl flex items-center justify-center mb-6">
                <VSCodeLogo size={28} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                VS Code Extension
              </h2>
              <p className="text-slate-400 mb-6 flex-1">
                The full Multimeter experience — custom editor, UI panels, mock server,
                environment manager, test history, AI assistant, and more.
              </p>

              {/* Install */}
              <div className="space-y-4">
                {vscodeVersion && (
                  <p className="text-sm text-slate-500">
                    Latest version: <span className="text-white font-medium">{vscodeVersion}</span>
                  </p>
                )}

                <a
                  href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-semibold transition-colors w-full"
                >
                  <ExternalLink size={16} />
                  Open in VS Code Marketplace
                </a>
              </div>
            </div>
          </FadeIn>

          {/* CLI */}
          <FadeIn delay={200}>
            <div className="bg-surface-light border border-border rounded-2xl p-8 h-full flex flex-col">
              <div className="w-14 h-14 bg-[#C12127]/10 rounded-xl flex items-center justify-center mb-6">
                <NpmLogo size={28} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                CLI Tool — testlight
              </h2>
              <p className="text-slate-400 mb-6 flex-1">
                Run your .mmt tests in CI/CD pipelines, automation scripts, or from the
                terminal. Same test files, same results — everywhere.
                Both <code className="text-accent">testlight</code> and <code className="text-accent">mmt</code> commands are available.
              </p>

              {/* Install methods */}
              <div className="space-y-4">
                {npmVersion && (
                  <p className="text-sm text-slate-500">
                    Latest version: <span className="text-white font-medium">{npmVersion}</span>
                  </p>
                )}

                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Install globally:</p>
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-slate-500 shrink-0" />
                    <code className="text-sm text-slate-300">
                      npm install -g mmt-testlight
                    </code>
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Run without installing:</p>
                  <code className="text-sm text-slate-300">
                    npx mmt-testlight run path/to/test.mmt
                  </code>
                </div>

                <a
                  href="https://www.npmjs.com/package/mmt-testlight"
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
