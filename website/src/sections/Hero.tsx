import { ArrowRight, Download } from 'lucide-react'
import FadeIn from '../components/FadeIn'

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 hero-glow pointer-events-none" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <FadeIn>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-surface-light border border-border rounded-full px-4 py-1.5 mb-8">
            <span className="text-xs font-medium text-accent">Open Source</span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-400">MIT Licensed</span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-400">Free Forever</span>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6 tracking-tight">
            All possible tests for
            <br />
            your service —{' '}
            <span className="gradient-text">as code</span>
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            A free, open-source VS Code extension for writing, running, and managing structured
            API tests as version-controlled YAML files. No login. No cloud. No limits.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
            >
              <Download size={18} />
              Install VS Code Extension
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </a>
            <a
              href="https://github.com/mshobeyri/multimeter"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-border hover:border-slate-500 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all hover:bg-surface-light"
            >
              View on GitHub
            </a>
          </div>
        </FadeIn>

        {/* Hero screenshot */}
        <FadeIn delay={400}>
          <div className="mt-16 sm:mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent z-10 pointer-events-none" />
            <div className="glow rounded-2xl overflow-hidden border border-border">
              <img
                src="/screenshots/test_panel_flow.png"
                alt="Multimeter Test Flow Editor"
                className="w-full rounded-2xl"
              />
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
