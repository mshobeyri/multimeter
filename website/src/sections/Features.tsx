import {
  DollarSign,
  GitBranch,
  Bot,
  Layers,
  Shield,
  Server,
  FileText,
  Repeat,
  Gauge,
  MousePointer2,
  Terminal,
} from 'lucide-react'
import FadeIn from '../components/FadeIn'

function VSCodeLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M246.94 27.638 194.193 2.241a15.947 15.947 0 0 0-18.194 3.3L2.453 159.039a10.667 10.667 0 0 0 .005 15.931l17.511 15.986a10.667 10.667 0 0 0 13.625.975L237.054 18.2a10.666 10.666 0 0 1 16.946 8.63v-1.205a16 16 0 0 0-7.06-7.988Z" fill="#0065A9"/>
      <path d="M246.94 228.362 194.193 253.76a15.946 15.946 0 0 1-18.194-3.3L2.453 96.961A10.667 10.667 0 0 1 2.458 81.03l17.511-15.986a10.666 10.666 0 0 1 13.625-.975l203.46 173.731a10.667 10.667 0 0 0 16.946-8.63v1.205a16.001 16.001 0 0 1-7.06 7.987Z" fill="#007ACC"/>
      <path d="M194.196 253.763A15.955 15.955 0 0 1 176 250.461c5.9 5.9 16 1.722 16-6.627V12.166c0-8.349-10.1-12.528-16-6.627a15.955 15.955 0 0 1 18.196-3.302l52.746 25.399A16 16 0 0 1 256 42.056v171.888a16 16 0 0 1-9.058 14.42l-52.746 25.399Z" fill="#1F9CF0"/>
    </svg>
  )
}

const features = [
  {
    icon: DollarSign,
    title: 'Free & Open Source',
    description:
      '100% free and open source under BSL license. No subscriptions, no feature gates, no restrictions.',
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
    icon: MousePointer2,
    title: 'Drag & Drop Test Builder',
    description:
      'Build functional test flows visually with calls, asserts, checks, delays, and conditions — no scripting required.',
    color: 'text-lime-400',
    bg: 'bg-lime-400/10',
  },
  {
    icon: Layers,
    title: 'One Tool Replaces Many',
    description:
      'API testing, beta load testing, mock servers, documentation — one tool instead of Postman, JMeter, and more.',
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
    icon: Terminal,
    title: 'CI/CD Ready',
    description:
      'Run the same .mmt files in pipelines with testlight, export reports, and keep automation version-controlled.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
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
    icon: Gauge,
    title: 'Load Testing (Beta)',
    description:
      'Run one .mmt test scenario with threads, ramp-up, repeat limits, and load-oriented reports.',
    color: 'text-red-400',
    bg: 'bg-red-400/10',
  },
  {
    icon: VSCodeLogo,
    title: 'VS Code Native',
    description:
      'Design, run, debug, and review API tests inside VS Code with native panels and Git-friendly files.',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
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
