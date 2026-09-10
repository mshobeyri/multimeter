import { useEffect, useState } from 'react'
import { ArrowRight, Download } from 'lucide-react'
import HeroIllustration from '../components/HeroIllustration'

const qualities = [
  'AI-Native',
  'Git-native',
  'No Lock-in',
  'One Tool',
  'YAML-based',
  'Dev-First',
  'Drag & Drop',
  'CI/CD Ready',
  'Open Source',
  '100% Local',
  'No Code'
]

const features = [
  'AI Checks',
  'API Test',
  'Mock Server',
  'Load Test',
  'WebSocket Test',
  'Test Suites',
  'Smoke Tests',
  'CI Reports',
]

const toolLogos = [
  { name: 'Postman', logo: '/competitors/postman.svg', color: 'bg-orange-500/10 text-orange-200 border-orange-400/25' },
  { name: 'Insomnia', logo: '/competitors/insomnia.svg', color: 'bg-purple-500/10 text-purple-200 border-purple-400/25' },
  { name: 'Bruno', logo: '/competitors/bruno.svg', color: 'bg-yellow-500/10 text-yellow-100 border-yellow-400/25' },
  { name: 'Robot Framework', logo: '/competitors/robotframework.svg', color: 'bg-slate-500/10 text-slate-200 border-slate-400/25' },
  { name: 'Cucumber', logo: '/competitors/cucumber.svg', color: 'bg-green-500/10 text-green-200 border-green-400/25' },
  { name: 'JMeter', logo: '/competitors/jmeter.svg', color: 'bg-red-500/10 text-red-200 border-red-400/25' },
  { name: 'NeoLoad', logo: '/competitors/neoload.svg', color: 'bg-blue-500/10 text-blue-200 border-blue-400/25' },
  { name: 'Karate', logo: '/competitors/karate.svg', color: 'bg-cyan-500/10 text-cyan-200 border-cyan-400/25' },
]

function SlotMachine() {
  const [qualityIndex, setQualityIndex] = useState(0)
  const [featureIndex, setFeatureIndex] = useState(0)

  useEffect(() => {
    const interval1 = window.setInterval(() => {
      if (document.hidden) {
        return
      }
      setQualityIndex((i) => (i + 1) % qualities.length)
    }, 3000)

    const interval2 = window.setInterval(() => {
      if (document.hidden) {
        return
      }
      setFeatureIndex((i) => (i + 1) % features.length)
    }, 2500)

    return () => {
      window.clearInterval(interval1)
      window.clearInterval(interval2)
    }
  }, [])

  return (
    <h1
      style={{
        fontWeight: 800,
        letterSpacing: '-0.025em',
        lineHeight: 1.25,
        marginBottom: 16,
        textAlign: 'center',
        color: '#ffffff',
        fontSize: 'clamp(1.5rem, 4vw, 3rem)',
      }}
    >
      <span style={{ display: 'block' }}>
        <span key={`q-${qualityIndex}`} className="hero-slot-word" style={{ color: '#818cf8' }}>
          {qualities[qualityIndex]}
        </span>
        <span style={{ color: '#64748b', fontWeight: 300, margin: '0 0.6rem' }}>|</span>
        <span key={`f-${featureIndex}`} className="hero-slot-word" style={{ color: '#22d3ee' }}>
          {features[featureIndex]}
        </span>
      </span>
      <span style={{ display: 'block', color: '#ffffff' }}>right in your repo.</span>
    </h1>
  )
}

export default function Hero() {
  return (
    <>
      <section className="relative pt-36 sm:pt-44 pb-24 sm:pb-36">
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-12 sm:py-16">
          <SlotMachine />

          <div className="max-w-4xl mx-auto mb-10 pt-8 sm:pt-10">
            <p className="text-lg sm:text-xl text-white font-semibold mb-4">
              Start with a request. Grow into a testing platform. Never switch tools.
            </p>
            <p className="text-base sm:text-lg text-slate-400 max-w-3xl mx-auto">
              Git-native and <span className="text-white font-bold">AI-native</span> API testing
              for VS Code and CI. YAML <span className="text-slate-200">.mmt</span> files,
              CLI <span className="text-slate-200">testlight</span>, MCP <span className="text-slate-200">mmt-mcp</span>.
              {' '}
              <span className="text-white font-bold">Judge responses with AI</span> in the same test flow.
              Alternative to Postman, Bruno, and <span className="text-white font-bold">Promptfoo</span>. Not an electrical meter.
            </p>
          </div>

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
        </div>
      </section>

      <section className="relative bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <HeroIllustration />
        </div>
      </section>
    </>
  )
}
