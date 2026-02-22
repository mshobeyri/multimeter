import { ArrowRight, Download } from 'lucide-react'
import FadeIn from '../components/FadeIn'

export default function CTA() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <FadeIn>
          <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-r from-primary/10 to-accent/10 rounded-3xl blur-3xl pointer-events-none" />
            <div className="relative bg-surface-light border border-border rounded-3xl p-12 sm:p-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">
                Ready to simplify your
                <br />
                <br />
                <span className="gradient-text">API testing?</span>
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
                Install Multimeter in VS Code and start testing in seconds.
                No account needed. No complex setup.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
                >
                  <Download size={20} />
                  Install Extension
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </a>
                <a
                  href="https://github.com/mshobeyri/multimeter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-border hover:border-slate-500 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:bg-surface"
                >
                  Star on GitHub ⭐
                </a>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
