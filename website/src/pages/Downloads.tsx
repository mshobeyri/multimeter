import { useState, useEffect } from 'react'
import { ExternalLink, Download } from 'lucide-react'
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

function AppleLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 315" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path d="M213.803 167.03c.442 47.58 41.74 63.413 42.197 63.615-.35 1.116-6.599 22.563-21.757 44.716-13.104 19.153-26.705 38.235-48.13 38.63-21.05.388-27.82-12.483-51.888-12.483-24.061 0-31.582 12.088-51.51 12.871-20.68.783-36.428-20.71-49.64-39.793-27-39.033-47.633-110.3-19.928-158.406 13.763-23.89 38.36-39.017 65.056-39.405 20.307-.388 39.475 13.662 51.889 13.662 12.406 0 35.699-16.895 60.186-14.414 10.25.427 39.026 4.14 57.503 31.186-1.49.923-34.335 20.044-33.978 59.822M174.24 50.199c10.98-13.29 18.369-31.79 16.353-50.199-15.826.636-34.962 10.546-46.314 23.828-10.173 11.763-19.082 30.589-16.678 48.633 17.64 1.365 35.66-8.964 46.639-22.262" fill="#fff"/>
    </svg>
  )
}

function LinuxLogo({ size = 28 }: { size?: number }) {
  return <img src="/icons/linux.svg" width={size} height={size} alt="Linux" />
}

function WindowsLogo({ size = 28 }: { size?: number }) {
  return <img src="/icons/windows.svg" width={size} height={size} alt="Windows" />
}

function SnapLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <linearGradient id="snap-a" x1="128" y1="0" x2="128" y2="256" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#E95420"/>
        <stop offset="1" stopColor="#C44218"/>
      </linearGradient>
      <rect width="256" height="256" rx="40" fill="url(#snap-a)"/>
      <path d="M60 120 128 52l68 68-68 68-68-68Z" fill="none" stroke="#fff" strokeWidth="12" strokeLinejoin="round"/>
      <circle cx="128" cy="120" r="16" fill="#fff"/>
    </svg>
  )
}

function DockerLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 185" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
      <path d="M250.716 70.497c-5.222-3.56-17.247-4.865-26.468-3.076-1.218-8.893-6.223-16.616-15.228-23.576l-5.223-3.56-3.508 5.312c-4.438 6.786-6.656 16.226-5.916 25.275.435 3.342 1.74 9.285 5.265 14.466-3.726 2.08-11.048 4.86-20.703 4.684H.008l-.348 1.82c-1.566 9.112-1.566 37.546 21.355 59.424 17.377 16.573 43.41 24.968 77.475 24.968 73.836 0 128.476-34.202 154.073-96.332 10.07.218 31.685.088 42.82-21.22 .696-1.296 2.352-4.64 3.03-6.024l1.178-2.47-4.876-3.39ZM142.12 0H112.76v28.4h29.36V0Zm0 32.82H112.76v28.4h29.36V32.82Zm-33.78 0H78.98v28.4h29.36V32.82ZM74.56 65.64H45.2v28.4h29.36V65.64Zm33.78 0H78.98v28.4h29.36V65.64Zm33.78 0H112.76v28.4h29.36V65.64Zm33.78 0H146.54v28.4h29.36V65.64Zm33.78 0H180.32v28.4h29.36V65.64Zm-67.56-32.82H112.76v28.4h29.36V32.82Z" fill="#2496ED"/>
    </svg>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-2.5 font-mono text-sm text-slate-300 select-all">
      {children}
    </div>
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

      {/* ── VS Code Extension ── */}
      <section className="pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <FadeIn delay={100}>
            <div className="bg-surface-light border border-border rounded-2xl p-8 flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-16 h-16 bg-[#007ACC]/10 rounded-xl flex items-center justify-center shrink-0">
                <VSCodeLogo size={32} />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">
                  VS Code Extension
                </h2>
                <p className="text-slate-400">
                  The full Multimeter experience — custom editor, UI panels, mock server,
                  environment manager, test history, AI assistant, and more.
                </p>
                {vscodeVersion && (
                  <p className="text-sm text-slate-500 mt-2">
                    Latest: <span className="text-white font-medium">{vscodeVersion}</span>
                  </p>
                )}
              </div>
              <a
                href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-semibold transition-colors shrink-0"
              >
                <ExternalLink size={16} />
                Install Extension
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CLI section heading ── */}
      <section className="pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <FadeIn delay={150}>
            <h2 className="text-2xl font-bold text-white mb-2">
              CLI — <code className="text-accent font-normal">testlight</code>
            </h2>
            <p className="text-slate-400">
              Run <code className="text-accent">.mmt</code> tests from the terminal or CI/CD.
              Both <code className="text-accent">testlight</code> and <code className="text-accent">mmt</code> commands are available.
              {npmVersion && (
                <span className="text-slate-500 ml-2">v{npmVersion}</span>
              )}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── CLI platform cards ── */}
      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* npm */}
          <FadeIn delay={200}>
            <div className="bg-surface-light border border-border rounded-2xl p-6 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#C12127]/10 rounded-xl flex items-center justify-center">
                  <NpmLogo size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">npm</h3>
                  <p className="text-xs text-slate-500">Any platform with Node.js</p>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                <CodeBlock>npm install -g mmt-testlight</CodeBlock>
                <p className="text-xs text-slate-500">Or run directly:</p>
                <CodeBlock>npx mmt-testlight run test.mmt</CodeBlock>
              </div>
              <a
                href="https://www.npmjs.com/package/mmt-testlight"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 mt-4 border border-border hover:border-slate-500 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <ExternalLink size={14} />
                View on npm
              </a>
            </div>
          </FadeIn>

          {/* macOS (Homebrew) */}
          <FadeIn delay={250}>
            <div className="bg-surface-light border border-border rounded-2xl p-6 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                  <AppleLogo size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">macOS</h3>
                  <p className="text-xs text-slate-500">Homebrew — no Node.js needed</p>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                <CodeBlock>brew tap mshobeyri/multimeter</CodeBlock>
                <CodeBlock>brew install mmt-testlight</CodeBlock>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Standalone binary for Apple Silicon &amp; Intel.
              </p>
            </div>
          </FadeIn>

          {/* Linux */}
          <FadeIn delay={300}>
            <div className="bg-surface-light border border-border rounded-2xl p-6 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                  <LinuxLogo size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Linux</h3>
                  <p className="text-xs text-slate-500">DEB, RPM &amp; Snap packages</p>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                <p className="text-xs text-slate-500">Debian / Ubuntu:</p>
                <CodeBlock>sudo dpkg -i mmt-testlight_0.3.1_amd64.deb</CodeBlock>
                <p className="text-xs text-slate-500">Fedora / RHEL:</p>
                <CodeBlock>sudo rpm -i mmt-testlight-0.3.1.x86_64.rpm</CodeBlock>
                <p className="text-xs text-slate-500">Snap:</p>
                <CodeBlock>sudo snap install mmt-testlight</CodeBlock>
              </div>
            </div>
          </FadeIn>

          {/* Windows */}
          <FadeIn delay={350}>
            <div className="bg-surface-light border border-border rounded-2xl p-6 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#00ADEF]/10 rounded-xl flex items-center justify-center">
                  <WindowsLogo size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Windows</h3>
                  <p className="text-xs text-slate-500">x64 standalone binary</p>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                <p className="text-xs text-slate-500">Download the .zip from GitHub:</p>
                <a
                  href="https://github.com/mshobeyri/multimeter/releases/latest/download/testlight-v0.3.1-win-x64.zip"
                  className="flex items-center justify-center gap-2 bg-surface border border-border hover:border-slate-500 text-slate-300 hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={14} />
                  testlight-win-x64.zip
                </a>
                <p className="text-xs text-slate-500">
                  Extract and add to your PATH.
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Docker */}
          <FadeIn delay={400}>
            <div className="bg-surface-light border border-border rounded-2xl p-6 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#2496ED]/10 rounded-xl flex items-center justify-center">
                  <DockerLogo size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Docker</h3>
                  <p className="text-xs text-slate-500">Containerized runner</p>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                <CodeBlock>docker run --rm -v "$PWD:/w" -w /w mshobeyri/testlight run test.mmt</CodeBlock>
                <p className="text-xs text-slate-500">
                  Mount your project and run any <code className="text-accent">.mmt</code> file.
                </p>
              </div>
            </div>
          </FadeIn>

          {/* GitHub Releases */}
          <FadeIn delay={450}>
            <div className="bg-surface-light border border-border rounded-2xl p-6 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                  <svg width={24} height={24} viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6C29.304 70.213 17.9 65.96 17.9 46.957c0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.57 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0Z" fill="#fff"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">All Releases</h3>
                  <p className="text-xs text-slate-500">Binaries, checksums &amp; changelogs</p>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-400">
                  Pre-built binaries for every platform, SHA-256 checksums, and release notes.
                </p>
              </div>
              <a
                href="https://github.com/mshobeyri/multimeter/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 mt-4 border border-border hover:border-slate-500 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <ExternalLink size={14} />
                GitHub Releases
              </a>
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
                <p className="text-sm text-slate-500 mb-1">Node.js (for npm CLI)</p>
                <p className="text-lg font-semibold text-white">≥ 18.x</p>
              </div>
              <div className="bg-surface-light border border-border rounded-xl p-6 text-center">
                <p className="text-sm text-slate-500 mb-1">Standalone binaries</p>
                <p className="text-lg font-semibold text-white">No runtime needed</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <FAQ />
    </div>
  )
}
