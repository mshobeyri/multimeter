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
                src="/screenshots/git.png"
                alt="Multimeter tests versioned in Git"
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
                Tests are plain YAML <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">.mmt</code> files
                stored right next to your source code. No proprietary formats,
                no cloud sync — just files in your repo, versioned and reviewed
                like everything else.
              </p>
              <ul className="space-y-4 mb-6">
                {[
                  'Code and tests reviewed in the same pull request',
                  'Check out an older branch and run its tests — they always match that version',
                  'Share a reproduced bug as a committed test — anyone can pull and re-run it',
                  'No separate user management — your Git permissions are enough',
                  'Works with any VCS: Git, SVN, Mercurial — they are just files',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="bg-surface-light border border-border rounded-xl p-4 font-mono text-sm text-slate-300 overflow-x-auto">
                <span className="text-slate-500">$</span> git commit -m <span className="text-accent">"Add title and an example to reproduce bug 1234"</span>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
