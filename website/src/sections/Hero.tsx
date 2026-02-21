import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Download } from 'lucide-react'
import FadeIn from '../components/FadeIn'
import HeroIllustration from '../components/HeroIllustration'

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null)
  const [spacerH, setSpacerH] = useState(0)

  useEffect(() => {
    const el = heroRef.current
    if (!el) { return }

    const update = () => {
      setSpacerH(el.offsetHeight)
    }
    update()

    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => { ro.disconnect() }
  }, [])

  return (
    <>
      {/* Fixed background hero text — stays in place while page scrolls over it */}
      <div ref={heroRef} className="fixed inset-x-0 top-0 z-0 pt-32 sm:pt-40 pb-20 sm:pb-32 overflow-hidden">
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
        </div>
      </div>

      {/* Spacer matching the fixed hero height so illustration starts right after */}
      <div style={{ height: spacerH }} />

      {/* Scrollable illustration — scrolls up over the fixed text */}
      <section className="relative z-10 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn delay={400}>
            <div className="relative -mt-8">
              <HeroIllustration />
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
