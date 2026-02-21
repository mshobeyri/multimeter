import FadeIn from '../components/FadeIn'

export default function GitNative() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Screenshot — left on desktop */}
          <FadeIn direction="left" delay={200}>
            <div className="order-2 lg:order-1 glow rounded-2xl overflow-hidden border border-border">
              <img
                src="/screenshots/environment_panel.png"
                alt="Multimeter YAML files and environment panel"
                className="w-full rounded-2xl"
              />
            </div>
          </FadeIn>

          {/* Text — right on desktop */}
          <FadeIn direction="right" className="order-1 lg:order-2">
            <div>
              <span className="text-orange-400 text-sm font-semibold uppercase tracking-wider">
                Version Controlled
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-6">
                Collaborate via Git
              </h2>
              <p className="text-lg text-slate-400 mb-6 leading-relaxed">
                Or any version control system of your choice. Tests are plain YAML <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code> files
                stored in your repository alongside your source code. No proprietary formats,
                no cloud sync, no separate version control.
              </p>
              <div className="bg-surface-light border border-border rounded-xl p-6">
                <pre className="text-sm text-slate-300 overflow-x-auto">
                  <code>{`my-project/
├── src/
│   └── api/
├── tests/
│   ├── _environments.mmt    # env presets
│   ├── login-api.mmt        # API definition
│   ├── login-test.mmt       # test flow
│   └── smoke-suite.mmt      # test suite
├── package.json
└── .gitignore`}</code>
                </pre>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
