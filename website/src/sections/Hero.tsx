import { ArrowRight, Check, Download, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import HeroIllustration from '../components/HeroIllustration'

const POINTS = [
  'YAML files live in Git',
  'Same files in VS Code and CI',
  'Open specs without converting',
]

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_120px,rgba(99,102,241,0.16),transparent)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface/40 via-transparent to-surface" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-12 lg:pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-sm text-slate-300 mb-8">
            Apache 2.0 · No account
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-8">
            Git-native REST client and{' '}
            <span className="gradient-text">API tests</span> in VS Code
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 mb-10 leading-relaxed mx-auto max-w-xl">
            Requests, tests, mocks, and docs are YAML in Git — same files in VS Code and in CI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-10 justify-center">
            <a
              href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-base font-semibold transition-colors"
            >
              <Download size={18} />
              Install
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </a>
            <Link
              to="/demos"
              className="inline-flex items-center justify-center gap-2 border border-white/15 hover:border-white/30 text-white px-6 py-3 rounded-xl text-base font-semibold transition-colors hover:bg-white/5"
            >
              <Play size={16} />
              Watch demo
            </Link>
          </div>
          <ul className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-x-8 gap-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-center justify-center gap-3 text-sm text-slate-300">
                <Check size={16} className="text-emerald-400 shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 lg:pb-24">
        <HeroIllustration />
      </div>
    </section>
  )
}
