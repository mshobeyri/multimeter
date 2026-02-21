import { Check, X } from 'lucide-react'
import FadeIn from '../components/FadeIn'

interface FeatureRow {
  feature: string
  multimeter: boolean | string
  postman: boolean | string
  bruno: boolean | string
}

const features: FeatureRow[] = [
  { feature: 'Price', multimeter: 'Free', postman: '$14/user/mo', bruno: '$6/user/mo' },
  { feature: 'HTTP / REST', multimeter: true, postman: true, bruno: true },
  { feature: 'WebSocket', multimeter: true, postman: true, bruno: true },
  { feature: 'gRPC', multimeter: true, postman: true, bruno: true },
  { feature: 'Account Required', multimeter: false, postman: true, bruno: false },
  { feature: 'Git-Native Files', multimeter: true, postman: false, bruno: true },
  { feature: 'VS Code Integration', multimeter: 'Native', postman: 'Plugin', bruno: 'Separate app' },
  { feature: 'AI Test Generation', multimeter: true, postman: true, bruno: false },
  { feature: 'Mock Server', multimeter: true, postman: true, bruno: false },
  { feature: 'Auto API Docs', multimeter: true, postman: true, bruno: false },
  { feature: 'Test Suites', multimeter: true, postman: true, bruno: true },
  { feature: 'CI/CD CLI', multimeter: true, postman: true, bruno: true },
  { feature: 'Environment Presets', multimeter: true, postman: true, bruno: true },
  { feature: 'Postman Import', multimeter: true, postman: '—', bruno: true },
  { feature: 'OpenAPI Import', multimeter: true, postman: true, bruno: true },
  { feature: 'Data Extraction (JSONPath/XPath)', multimeter: true, postman: 'Scripting', bruno: 'Scripting' },
  { feature: 'Fully Offline', multimeter: true, postman: false, bruno: true },
  { feature: 'Open Source', multimeter: 'MIT', postman: false, bruno: 'Partial' },
]

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm">{value}</span>
  }
  if (value) {
    return <Check size={18} className="text-green-400 mx-auto" />
  }
  return <X size={18} className="text-red-400/60 mx-auto" />
}

export default function Comparison() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-light/30">
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              How Multimeter compares
            </h2>
            <p className="text-lg text-slate-400">
              See how we stack up against other popular API testing tools
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <img src="/logo.svg" alt="Multimeter" className="w-6 h-6" />
                      <span className="text-sm font-semibold text-primary-light">
                        Multimeter
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400 text-center">
                    Postman
                  </th>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400 text-center">
                    Bruno
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((row, index) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-border/50 ${
                      index % 2 === 0 ? 'bg-surface-light/30' : 'bg-surface/50'
                    }`}
                  >
                    <td className="px-6 py-3.5 text-sm text-slate-300">
                      {row.feature}
                    </td>
                    <td className="px-6 py-3.5 text-center text-green-400 font-medium">
                      <CellValue value={row.multimeter} />
                    </td>
                    <td className="px-6 py-3.5 text-center text-slate-400">
                      <CellValue value={row.postman} />
                    </td>
                    <td className="px-6 py-3.5 text-center text-slate-400">
                      <CellValue value={row.bruno} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
