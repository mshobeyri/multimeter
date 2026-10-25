import { Link } from 'react-router-dom'
import FadeIn from '../components/FadeIn'
import { ArrowRight, Zap } from 'lucide-react'

const FIVE_X_GRADIENT = 'linear-gradient(135deg,#22d3ee,#818cf8 40%,#a78bfa 70%,#f472b6)'
const LINK_GRADIENT = 'linear-gradient(135deg,#22d3ee,#818cf8 40%,#a78bfa 70%,#f472b6)'

const fiveXGradientText = {
  backgroundImage: FIVE_X_GRADIENT,
  WebkitBackgroundClip: 'text' as const,
  backgroundClip: 'text' as const,
  color: 'transparent',
}

const linkGradientText = {
  backgroundImage: LINK_GRADIENT,
  WebkitBackgroundClip: 'text' as const,
  backgroundClip: 'text' as const,
  color: 'transparent',
}

export default function FasterThanPostman() {
  return (
    <section id="speed" className="scroll-mt-20 px-4 sm:px-6 lg:px-8 bg-surface-light/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-center">
          <FadeIn direction="left">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Zap size={16} className="text-[#22d3ee] shrink-0" />
                <span style={linkGradientText}>Time is money</span>
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4 leading-snug">
                About 5× faster than Postman on a simple test — and the gap grows.
              </h2>
              <p className="text-base sm:text-lg text-slate-400 mb-8 leading-relaxed">
                Parallel stages and cached setup make Multimeter ~5× faster than Newman on a small
                Open-Meteo sample — a real project with live HTTP calls, not a synthetic micro-bench —
                and the gap grows as your suite gets bigger.
              </p>
              <Link
                to="/compare/postman"
                className="group inline-flex items-center gap-2 font-semibold"
              >
                <span style={linkGradientText}>See the Postman comparison</span>
                <ArrowRight
                  size={18}
                  className="text-[#a78bfa] group-hover:translate-x-1 transition-transform shrink-0"
                />
              </Link>
            </div>
          </FadeIn>

          <FadeIn direction="right" delay={120}>
            <div className="flex flex-col items-center select-none" aria-hidden="true">
              <p className="flex items-center justify-center font-extrabold tracking-tight leading-none font-sans">
                <span
                  className="text-[9.8rem] sm:text-[12.6rem] lg:text-[15.4rem]"
                  style={fiveXGradientText}
                >
                  5
                </span>
                <span
                  className="text-[6.86rem] sm:text-[8.82rem] lg:text-[10.78rem] -translate-y-[0.08em]"
                  style={fiveXGradientText}
                >
                  ×
                </span>
              </p>
              <p
                className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-[0.35em] font-sans"
                style={fiveXGradientText}
              >
                Faster
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
