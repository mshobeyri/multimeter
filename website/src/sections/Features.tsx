import {
  DollarSign,
  GitBranch,
  Bot,
  Layers,
  Shield,
  Server,
  FileText,
  Repeat,
} from 'lucide-react'
import FadeIn from '../components/FadeIn'

const features = [
  {
    icon: DollarSign,
    title: 'Free for Small Businesses',
    description:
      'Small teams get every feature at no cost. No paywalls, no feature gates — just install and start testing.',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    icon: GitBranch,
    title: 'Git-Native & YAML',
    description:
      'Tests are plain YAML files versioned in Git alongside your code. PRs, reviews, and diffs work naturally.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: Bot,
    title: 'AI Test Generation',
    description:
      'Ask the built-in AI assistant to generate tests from descriptions, OpenAPI specs, or existing APIs.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    icon: Layers,
    title: 'One Tool Replaces Many',
    description:
      'API testing, load testing, mock servers, documentation — one tool instead of Postman, JMeter, and more.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description:
      'Everything stays local. No cloud sync, no data collection, no external uploads. Your credentials are safe.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  {
    icon: Server,
    title: 'Built-in Mock Server',
    description:
      'Spin up HTTP and WebSocket mock servers instantly. Perfect for frontend development and integration testing.',
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
  },
  {
    icon: FileText,
    title: 'Auto-Generated Docs',
    description:
      'Generate beautiful HTML or Markdown API documentation directly from your .mmt test files.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    icon: Repeat,
    title: 'Import & Convert',
    description:
      'Seamlessly import from Postman collections and OpenAPI specifications. Zero-friction migration.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
  },
]

export default function Features() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything you need.{' '}
              <span className="gradient-text">Nothing you don't.</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Multimeter gives you the power of enterprise testing tools with the simplicity
              of a single VS Code extension.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FadeIn key={feature.title} delay={index * 75}>
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
