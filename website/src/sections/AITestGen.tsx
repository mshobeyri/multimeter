import FadeIn from '../components/FadeIn'
import AIIllustration from '../components/AIIllustration'
import { Sparkles, Wand2, Scale } from 'lucide-react'

const capabilities = [
  {
    icon: Wand2,
    title: 'Write tests',
    description:
      'Generate complete .mmt flows from natural language, OpenAPI specs, or existing APIs with the @Multimeter chat participant.',
  },
  {
    icon: Scale,
    title: 'Judge with AI',
    description:
      'Evaluate non-deterministic replies in the same run — relevance, similarity, faithfulness, and factuality using your own model (Ollama or cloud).',
  },
]

export default function AITestGen() {
  return (
    <section id="ai-test-generation" className="scroll-mt-20 py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <FadeIn direction="up">
          <div className="text-center mb-14">
            <span className="text-purple-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2 justify-center">
              <Sparkles size={16} />
              AI-Native
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Let AI write — and <span className="gradient-text">judge</span> — your tests
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Use AI where it helps most: authoring flows quickly, and scoring fuzzy or AI-generated
              API replies in the same <span className="text-slate-200">.mmt</span> run.
              An alternative to a separate Promptfoo eval stack.
            </p>
          </div>
        </FadeIn>

        <FadeIn direction="up" delay={80}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-14">
            {capabilities.map((item) => (
              <div
                key={item.title}
                className="bg-surface-light border border-border rounded-2xl p-6 hover:border-purple-400/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-400/10 text-purple-400 flex items-center justify-center mb-4">
                  <item.icon size={20} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn direction="up" delay={150}>
          <div className="max-w-5xl mx-auto">
            <AIIllustration />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
