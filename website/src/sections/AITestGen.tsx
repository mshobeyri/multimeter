import FadeIn from '../components/FadeIn'
import AIIllustration from '../components/AIIllustration'
import { Sparkles } from 'lucide-react'

export default function AITestGen() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <FadeIn direction="up">
          <div className="text-center mb-14">
            <span className="text-purple-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2 justify-center">
              <Sparkles size={16} />
              AI-Powered
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Let AI write your tests
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              The built-in <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">@Multimeter</code> chat
              participant in VS Code can generate complete test flows from natural language
              descriptions, OpenAPI specs, or existing API definitions.
            </p>
          </div>
        </FadeIn>

        {/* Interactive illustration */}
        <FadeIn direction="up" delay={150}>
          <div className="max-w-5xl mx-auto">
            <AIIllustration />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
