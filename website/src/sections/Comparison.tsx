import { Check, X } from 'lucide-react'
import FadeIn from '../components/FadeIn'

interface FeatureRow {
  feature: string
  multimeter: boolean | string
  postman: boolean | string
  bruno: boolean | string
}

const features: FeatureRow[] = [
  { feature: 'Price', multimeter: 'From $0', postman: '$14/user/mo', bruno: '$6/user/mo' },
  { feature: 'HTTP / REST', multimeter: true, postman: true, bruno: true },
  { feature: 'WebSocket', multimeter: true, postman: true, bruno: true },
  { feature: 'gRPC', multimeter: true, postman: true, bruno: true },
  { feature: 'Git-Native Files', multimeter: true, postman: false, bruno: true },
  { feature: 'VS Code Integration', multimeter: 'Native', postman: 'Plugin', bruno: 'Separate app' },
  { feature: 'Interactive API Docs (HTML)', multimeter: true, postman: false, bruno: false },
  { feature: 'Markdown API Docs', multimeter: true, postman: false, bruno: false },
  { feature: 'Try-It Buttons in Docs', multimeter: true, postman: false, bruno: false },
  { feature: 'Declarative Test Flows (YAML)', multimeter: true, postman: false, bruno: false },
  { feature: 'Drag & Drop Test Builder', multimeter: true, postman: false, bruno: false },
  { feature: 'AI Test Generation', multimeter: true, postman: true, bruno: false },
  { feature: 'Mock Server', multimeter: true, postman: 'Cloud only', bruno: false },
  { feature: 'Mock Server Reflect Mode', multimeter: true, postman: false, bruno: false },
  { feature: 'mTLS / Client Certificates', multimeter: true, postman: true, bruno: true },
  { feature: 'Certificate Management in Config', multimeter: true, postman: false, bruno: false },
  { feature: 'Test Suites (Parallel + Sequential)', multimeter: true, postman: 'Sequential', bruno: false },
  { feature: 'CI/CD CLI', multimeter: true, postman: true, bruno: true },
  { feature: 'Same Engine in IDE & CLI', multimeter: true, postman: false, bruno: true },
  { feature: 'Environment Presets', multimeter: true, postman: true, bruno: true },
  { feature: 'Dynamic Tokens (random, date, uuid)', multimeter: true, postman: true, bruno: false },
  { feature: 'Data Extraction (JSONPath/XPath/Regex)', multimeter: true, postman: 'Scripting', bruno: 'Scripting' },
  { feature: 'Postman Import', multimeter: true, postman: '—', bruno: true },
  { feature: 'OpenAPI Import', multimeter: true, postman: true, bruno: true },
  { feature: 'Curl Import & Execution', multimeter: true, postman: true, bruno: true },
  { feature: 'JS Helper Module Imports', multimeter: true, postman: false, bruno: false },
  { feature: 'CSV Data-Driven Testing', multimeter: true, postman: true, bruno: false },
  { feature: 'Fully Offline', multimeter: true, postman: false, bruno: true },
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
