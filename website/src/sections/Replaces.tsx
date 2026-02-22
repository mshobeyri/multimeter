import { User, Users, Building2, Building } from 'lucide-react'
import FadeIn from '../components/FadeIn'

const plans = [
  {
    name: 'Individual',
    icon: User,
    price: 'Free',
    period: '',
    description: 'For personal projects and solo developers',
    color: 'border-green-400/50',
    highlight: false,
    badge: null,
  },
  {
    name: 'Small Business',
    icon: Users,
    price: 'Free',
    period: 'up to 20 users',
    description: 'For small teams getting started',
    color: 'border-primary/50',
    highlight: true,
    badge: 'Most Popular',
  },
  {
    name: 'Business',
    icon: Building2,
    price: '$2',
    period: '/user/month · 20–50 users',
    description: 'For growing teams that need more',
    color: 'border-accent/50',
    highlight: false,
    badge: null,
  },
  {
    name: 'Enterprise',
    icon: Building,
    price: '$1',
    period: '/user/month · 50+ users',
    description: 'Best value for large organizations',
    color: 'border-purple-400/50',
    highlight: false,
    badge: 'Best Value',
  },
]

export default function Replaces() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-light/30">
      <div className="max-w-7xl mx-auto text-center">
        <FadeIn>
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
            Simple, transparent{' '}
            <span className="gradient-text">pricing</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12">
            One tool for API testing, load testing, mock servers, documentation, and more.
            No hidden fees. No feature gates.
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-surface border-2 ${plan.color} rounded-2xl p-6 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlight ? 'ring-1 ring-primary/30 shadow-lg shadow-primary/10' : ''
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      plan.badge === 'Most Popular'
                        ? 'bg-primary text-white'
                        : 'bg-purple-400 text-white'
                    }`}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="w-12 h-12 rounded-xl bg-surface-light flex items-center justify-center mb-4 mt-2">
                  <plan.icon size={24} className="text-slate-300" />
                </div>

                <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{plan.description}</p>

                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm text-slate-400 ml-1">{plan.period}</span>
                  )}
                </div>

                <p className="text-xs text-slate-500">All features included</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
