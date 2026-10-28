import { ArrowRight, Download } from 'lucide-react'
import FadeIn from '../components/FadeIn'

export default function CTA() {
  return (
    <section className="px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-light px-8 py-10 sm:px-12 sm:py-12 text-center shadow-[0_20px_60px_rgba(2,6,23,0.25)]">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgba(99,102,241,0.12),transparent_65%)]"
              aria-hidden="true"
            />
            <div className="relative">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary-light">
                Get started
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-snug">
                Ready to simplify your API testing?
              </h2>
              <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto mb-7 leading-relaxed">
                Install Multimeter in VS Code and start testing in seconds.
                No account. No complex setup.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-sm sm:text-base font-semibold transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
                >
                  <Download size={18} />
                  Install Extension
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </a>
                <a
                  href="https://github.com/mshobeyri/multimeter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-border hover:border-slate-500 text-white px-6 py-3 rounded-xl text-sm sm:text-base font-semibold transition-all hover:bg-surface"
                >
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
