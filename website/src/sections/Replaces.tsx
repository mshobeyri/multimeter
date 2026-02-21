import FadeIn from '../components/FadeIn'

const tools = [
  { name: 'Postman', color: 'text-orange-400', price: '$14/mo' },
  { name: 'JMeter', color: 'text-red-400', price: 'Complex' },
  { name: 'Insomnia', color: 'text-purple-400', price: '$5/mo' },
  { name: 'NeoLoad', color: 'text-blue-400', price: '$$$' },
  { name: 'Robot Framework', color: 'text-green-400', price: 'Steep learning curve' },
  { name: 'Bruno', color: 'text-yellow-400', price: '$6/mo (Pro)' },
]

export default function Replaces() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-light/30">
      <div className="max-w-7xl mx-auto text-center">
        <FadeIn>
          <span className="text-green-400 text-sm font-semibold uppercase tracking-wider">
            Replace them all
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
            One tool to replace{' '}
            <span className="gradient-text">everything</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12">
            Stop juggling multiple paid tools. Multimeter covers API testing, load testing,
            mock servers, documentation, and more — free for small businesses.
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="relative max-w-4xl mx-auto">
            {/* Replaced tools */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="relative bg-surface border border-border rounded-xl p-5 opacity-60"
                >
                  <div className="absolute top-2 right-2">
                    <svg
                      className="w-6 h-6 text-red-400/60"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <p className={`font-semibold ${tool.color} mb-1`}>{tool.name}</p>
                  <p className="text-xs text-slate-500">{tool.price}</p>
                </div>
              ))}
            </div>

            {/* Arrow */}
            <div className="flex justify-center mb-8">
              <svg
                className="w-8 h-8 text-accent animate-bounce"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </div>

            {/* Multimeter */}
            <div className="bg-gradient-to-r from-primary/20 to-accent/20 border-2 border-primary/50 rounded-2xl p-8">
              <div className="flex items-center justify-center gap-3 mb-3">
                <img src="/logo.svg" alt="Multimeter" className="w-10 h-10" />
                <h3 className="text-2xl font-bold text-white">Multimeter</h3>
              </div>
              <p className="text-lg font-semibold text-green-400 mb-2">Free for small businesses</p>
              <p className="text-slate-400">
                All features included. No limits.
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
