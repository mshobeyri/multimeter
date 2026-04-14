import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Download } from 'lucide-react'
import FadeIn from '../components/FadeIn'
import HeroIllustration from '../components/HeroIllustration'

const qualities = [
  'Git-native',
  'No Lock-in',
  'One Tool',
  'YAML-based',
  'Dev-First',
  'Drag & Drop',
  'AI-Friendly',
  'CI/CD Ready',
  'Open Source',
  '100% Local',
  'No Code'
]

const features = [
  'API Test',
  'Mock Server',
  'Load Test',
  'Smoke Tests',
  'Documentation',
  'WebSocket Test',
  'Test Suites',
  'Test Reports',
]

function SlotMachine() {
  const [qualityIndex, setQualityIndex] = useState(0)
  const [featureIndex, setFeatureIndex] = useState(0)
  const [isSpinning1, setIsSpinning1] = useState(false)
  const [isSpinning2, setIsSpinning2] = useState(false)

  useEffect(() => {
    const interval1 = setInterval(() => {
      setIsSpinning1(true)
      setTimeout(() => {
        setQualityIndex((i) => (i + 1) % qualities.length)
        setIsSpinning1(false)
      }, 300)
    }, 3000)

    const interval2 = setInterval(() => {
      setIsSpinning2(true)
      setTimeout(() => {
        setFeatureIndex((i) => (i + 1) % features.length)
        setIsSpinning2(false)
      }, 300)
    }, 2500)

    return () => {
      clearInterval(interval1)
      clearInterval(interval2)
    }
  }, [])

  return (
    <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white leading-snug mb-4 tracking-tight">
      {/* Mobile: stacked layout */}
      <span className="flex flex-col items-center gap-2 sm:hidden">
        <span className="overflow-hidden h-[1.3em]">
          <span
            className={`inline-block whitespace-nowrap transition-all duration-300 ${
              isSpinning1 ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
            }`}
          >
            <span className="gradient-text">{qualities[qualityIndex]}</span>
          </span>
        </span>
        <span className="overflow-hidden h-[1.3em]">
          <span
            className={`inline-block whitespace-nowrap transition-all duration-300 ${
              isSpinning2 ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
            }`}
          >
            <span className="text-accent">{features[featureIndex]}</span>
          </span>
        </span>
      </span>

      {/* Desktop: side by side with fixed center pipe */}
      <span className="hidden sm:grid grid-cols-[1fr_auto_1fr] items-center max-w-4xl mx-auto">
        <span className="overflow-hidden h-[1.3em] text-right pr-4">
          <span
            className={`inline-block whitespace-nowrap transition-all duration-300 ${
              isSpinning1 ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
            }`}
          >
            <span className="gradient-text">{qualities[qualityIndex]}</span>
          </span>
        </span>
        <span className="text-slate-500 font-light">|</span>
        <span className="overflow-hidden h-[1.3em] text-left pl-4">
          <span
            className={`inline-block whitespace-nowrap transition-all duration-300 ${
              isSpinning2 ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
            }`}
          >
            <span className="text-accent">{features[featureIndex]}</span>
          </span>
        </span>
      </span>
      <span className="text-white">right in your repo.</span>
    </h1>
  )
}

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
      <div ref={heroRef} className="fixed inset-x-0 top-0 z-0 pt-48 sm:pt-64 pb-32 sm:pb-48 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-8">
          <FadeIn>
            <SlotMachine />
          </FadeIn>

          <FadeIn delay={100}>
            <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              From Postman-like API design to Robot-like execution, as version-controlled YAML files.
Built for API teams that want GUI speed and Git-friendly, scalable automation.
            </p>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
              >
                <Download size={18} />
                Build Your First Flow
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
      <div style={{ height: spacerH + 80 }} />

      {/* Scrollable illustration — scrolls up over the fixed text */}
      <section className="relative z-10 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn delay={300}>
            <div className="relative">
              <HeroIllustration />
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
