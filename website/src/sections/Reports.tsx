import FadeIn from '../components/FadeIn'
import { ClipboardCheck } from 'lucide-react'

const formats = [
  {
    ext: '.xml',
    name: 'JUnit XML',
    description: 'The universal CI/CD standard. Native support in GitHub Actions, GitLab CI, Jenkins, Azure Pipelines.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    ext: '.html',
    name: 'HTML Report',
    description: 'Self-contained visual report with dark/light themes, pass/fail indicators, and collapsible sections.',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
  },
  {
    ext: '.md',
    name: 'Markdown',
    description: 'GitHub-flavored Markdown tables. Paste directly into PRs, issues, wikis, or README files.',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    ext: '.mmt',
    name: 'MMT Report',
    description: 'Structured YAML report that opens in Multimeter for interactive review and re-export.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
]

export default function Reports() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-light/30">
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="text-center mb-14">
            <span className="text-emerald-400 text-sm font-semibold uppercase tracking-wider flex items-center justify-center gap-2">
              <ClipboardCheck size={16} />
              Test Reports
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Reports that fit your{' '}
              <span className="gradient-text">workflow</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Generate structured test reports from every run — in the IDE, from the CLI,
              or automatically via suite <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-sm">export</code> fields.
              Four formats, zero extra tooling.
            </p>
          </div>
        </FadeIn>

        {/* Format cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {formats.map((fmt, index) => (
            <FadeIn key={fmt.ext} delay={index * 100}>
              <div className="bg-surface border border-border rounded-2xl p-6 hover:border-emerald-400/40 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-white">{fmt.name}</h3>
                  <code className={`${fmt.color} text-xs bg-surface-light px-1.5 py-0.5 rounded`}>{fmt.ext}</code>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{fmt.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
