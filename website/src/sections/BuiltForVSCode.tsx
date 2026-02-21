import FadeIn from '../components/FadeIn'

export default function BuiltForVSCode() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-light/30">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <FadeIn direction="left">
            <div>
              <span className="text-accent text-sm font-semibold uppercase tracking-wider">
                VS Code Native
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-6">
                Built for your editor,
                <br />
                not a separate app
              </h2>
              <p className="text-lg text-slate-400 mb-6 leading-relaxed">
                Multimeter lives inside VS Code as a first-class extension. No context
                switching between your code editor and a separate API client. Everything —
                writing tests, running APIs, viewing results — happens in the same window
                where you write code.
              </p>
              <ul className="space-y-4">
                {[
                  'Custom YAML editor with split UI view',
                  'Activity bar panels for convertor, mock server & connections',
                  'Environment variables panel with preset switching',
                  'Full test history browser',
                  'AI chat participant for test generation',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          {/* Screenshot */}
          <FadeIn direction="right" delay={200}>
            <div className="glow rounded-2xl overflow-hidden border border-border">
              <img
                src="/screenshots/test_panel_test.png"
                alt="Multimeter inside VS Code"
                className="w-full rounded-2xl"
              />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
