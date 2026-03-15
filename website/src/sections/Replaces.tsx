import { Github, Heart, Code2, Users } from 'lucide-react'
import FadeIn from '../components/FadeIn'

const highlights = [
  {
    icon: Code2,
    title: 'BSL License',
    description: 'Use it anywhere — personal projects, startups, or enterprise.',
    color: 'text-green-400',
  },
  {
    icon: Github,
    title: 'Open Development',
    description: 'All development happens in the open on GitHub.',
    color: 'text-primary',
  },
  {
    icon: Users,
    title: 'Community Driven',
    description: 'Built with feedback from developers like you.',
    color: 'text-purple-400',
  },
  {
    icon: Heart,
    title: 'Forever Free',
    description: 'No subscriptions. No feature gates. No restrictions.',
    color: 'text-pink-400',
  },
]

export default function Replaces() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-light/30">
      <div className="max-w-7xl mx-auto text-center">
        <FadeIn>
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">
            Open Source
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
            100% free and{' '}
            <span className="gradient-text">open source</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12">
            Multimeter is open source under the BSL (Business Source License). Use it for any project,
            contribute to its development, or fork it for your own needs.
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto mb-12">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="bg-surface border border-border rounded-2xl p-6 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-surface-light flex items-center justify-center mb-4">
                  <item.icon size={24} className={item.color} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>

          <a
            href="https://github.com/mshobeyri/multimeter"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-slate-200 transition-colors"
          >
            <Github size={20} />
            View on GitHub
          </a>
        </FadeIn>
      </div>
    </section>
  )
}
