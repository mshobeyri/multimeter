import FadeIn from '../components/FadeIn'
import AIIllustration from '../components/AIIllustration'
import { Sparkles, Wand2, Scale, PlugZap } from 'lucide-react'

const capabilities = [
  {
    icon: PlugZap,
    title: 'MCP server',
    description:
      'The Multimeter MCP server lets Cursor, Copilot, and Claude scaffold, validate, format, and run .mmt files — with project context, not guessed YAML.',
  },
  {
    icon: Wand2,
    title: 'AI writes tests for you',
    description:
      'Describe an endpoint or point at OpenAPI — AI drafts complete .mmt test flows in seconds. Review, run, and commit the same files you would write by hand.',
  },
  {
    icon: Scale,
    title: 'AI judges fuzzy replies',
    description:
      'Add a judge step when a response is non-deterministic. It runs alongside classic status, JSON, and assert checks — not instead of them.',
  },
]

export default function AITestGen() {
  return (
    <section id="ai-test-generation" className="scroll-mt-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <FadeIn direction="up">
          <div className="text-center mb-12">
            <span className="text-purple-400 text-sm font-semibold uppercase tracking-wider flex items-center gap-2 justify-center">
              <Sparkles size={16} />
              AI &amp; MCP
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Let AI write and <span className="gradient-text">judge</span> your tests
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Agents connect through MCP, generate <span className="text-slate-200">.mmt</span> tests with little effort,
              and add AI judging where deterministic asserts are not enough.
            </p>
          </div>
        </FadeIn>

        <FadeIn direction="up" delay={80}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto mb-12">
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
