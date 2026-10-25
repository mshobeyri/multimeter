import { Link } from 'react-router-dom'
import FadeIn from '../components/FadeIn'
import AiOrbitGraphic from '../components/AiOrbitGraphic'
import { ArrowRight, Orbit } from 'lucide-react'

const ICON_GRADIENT = 'linear-gradient(135deg,#22d3ee,#818cf8 40%,#a78bfa 70%,#f472b6)'

const POINTS = [
  'Small Git-native files — agents open one area, not a giant Postman collection',
  'API files as a proxy — many tests share one inputs/outputs contract',
  'Suites keep run order editable YAML — parallel by default, then for stages',
  'Parallelism without a JS harness humans cannot review',
  'Declarative flows instead of pm.test scripts — less context, fewer hallucinations',
  'JSON and XML as YAML — denser trees, clearer diffs, validate before ship',
]

export default function WhyAiIntegrity() {
  return (
    <section
      id="why-ai-integrity"
      className="scroll-mt-20 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FadeIn direction="left">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 mb-0">
                <Orbit size={16} className="text-cyan-400" />
                <span
                  style={{
                    backgroundImage: ICON_GRADIENT,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  AI integrity
                </span>
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4 leading-snug">
                Other tools can use AI too.{' '}
                <span className="gradient-text">Multimeter is designed for it.</span>
              </h2>
              <p className="text-base sm:text-lg text-slate-400 mb-5 leading-relaxed">
                Cursor and Copilot work on Postman, Bruno, or pure JS — but agents drown in
                collections and scripts. Multimeter keeps the work clear for humans and AI:
              </p>
              <ul className="space-y-3 mb-8">
                {POINTS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                    <span className="text-slate-300 text-sm sm:text-base">{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/why-ai"
                className="group inline-flex items-center justify-center gap-3 text-white px-7 sm:px-9 py-3.5 sm:py-4 rounded-xl text-base sm:text-lg font-semibold transition-all shadow-lg shadow-fuchsia-500/20 hover:brightness-110 hover:shadow-fuchsia-400/30"
                style={{ backgroundImage: ICON_GRADIENT }}
              >
                Why Multimeter is better with AI
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform shrink-0"
                />
              </Link>
            </div>
          </FadeIn>

          <FadeIn direction="right" delay={120}>
            <AiOrbitGraphic />
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
