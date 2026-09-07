import {
  DollarSign,
  GitBranch,
  Bot,
  Scale,
  Server,
  Gauge,
  MousePointer2,
  Terminal,
  Workflow,
  Repeat,
} from 'lucide-react'
import FadeIn from '../components/FadeIn'

const features = [
  {
    icon: DollarSign,
    title: 'Free & Open Source',
    description:
      'Apache License 2.0. No subscriptions, no feature gates, no cloud lock-in.',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    icon: GitBranch,
    title: 'Git-Native & Local',
    description:
      'Plain YAML .mmt files in your repo. Diffs, PRs, and reviews stay local — no cloud sync of secrets.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: Scale,
    title: 'AI Response Checks',
    description:
      'Score non-deterministic replies in the same test flow — relevance, similarity, faithfulness, and factuality with your own model.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    icon: Bot,
    title: 'AI Test Generation',
    description:
      'Generate and refine .mmt tests from descriptions, OpenAPI specs, or existing APIs with the built-in assistant.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    icon: MousePointer2,
    title: 'Drag & Drop Flows',
    description:
      'Build functional test flows visually, then keep them as editable YAML.',
    color: 'text-lime-400',
    bg: 'bg-lime-400/10',
  },
  {
    icon: Workflow,
    title: 'Flowchart View',
    description:
      'See branches, loops, calls, and asserts as a flowchart for faster review.',
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
  },
  {
    icon: Server,
    title: 'Built-in Mock Server',
    description:
      'HTTP and WebSocket mocks from .mmt files — for local development and integration tests.',
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
  },
  {
    icon: Terminal,
    title: 'CI/CD Ready',
    description:
      'Run the same flows with testlight in pipelines and export HTML, Markdown, or JUnit when you need them.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  {
    icon: Gauge,
    title: 'Load Testing (Beta)',
    description:
      'Reuse a .mmt scenario with threads, ramp-up, and load-oriented reports.',
    color: 'text-red-400',
    bg: 'bg-red-400/10',
  },
  {
    icon: Repeat,
    title: 'Import Other Tools',
    description:
      'Bring in Postman, OpenAPI, WSDL, Bruno, .http / .rest, and curl — keep shipping as .mmt.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
  },
]

export default function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything you need.{' '}
              <span className="gradient-text">Nothing you don't.</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              API testing, mocks, suites, load, and AI judgment — one Git-native, AI-native workflow.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {features.map((feature, index) => (
            <FadeIn key={feature.title} delay={index * 60}>
              <div className="group relative bg-surface-light border border-border rounded-2xl p-6 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div
                  className={`${feature.bg} ${feature.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}
                >
                  <feature.icon size={24} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
