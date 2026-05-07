import { Check, X } from 'lucide-react'
import FadeIn from '../components/FadeIn'

type ToolKey = 'multimeter' | 'postman' | 'insomnia' | 'bruno' | 'robot' | 'cucumber' | 'jmeter' | 'neoload'
type Cell = boolean | string

interface FeatureRow {
  feature: string
  values: Record<ToolKey, Cell>
}

const tools: Array<{ key: ToolKey; name: string; logo: string; highlight?: boolean }> = [
  { key: 'multimeter', name: 'Multimeter', logo: '/logo.svg', highlight: true },
  { key: 'postman', name: 'Postman', logo: '/competitors/postman.svg' },
  { key: 'insomnia', name: 'Insomnia', logo: '/competitors/insomnia.svg' },
  { key: 'bruno', name: 'Bruno', logo: '/competitors/bruno.svg' },
  { key: 'robot', name: 'Robot Framework', logo: '/competitors/robotframework.svg' },
  { key: 'cucumber', name: 'Cucumber', logo: '/competitors/cucumber.svg' },
  { key: 'jmeter', name: 'JMeter', logo: '/competitors/jmeter.svg' },
  { key: 'neoload', name: 'NeoLoad', logo: '/competitors/neoload.svg' },
]

const features: FeatureRow[] = [
  {
    feature: 'Price',
    values: { multimeter: 'Free', postman: '$14/user/mo', insomnia: '$12/user/mo', bruno: '$6/user/mo', robot: 'Free', cucumber: 'Free', jmeter: 'Free', neoload: 'Enterprise' },
  },
  {
    feature: 'Open Source',
    values: { multimeter: true, postman: false, insomnia: 'Partial', bruno: 'Partial', robot: true, cucumber: true, jmeter: true, neoload: false },
  },
  {
    feature: 'HTTP / REST',
    values: { multimeter: true, postman: true, insomnia: true, bruno: true, robot: true, cucumber: 'Via code', jmeter: true, neoload: true },
  },
  {
    feature: 'WebSocket',
    values: { multimeter: true, postman: true, insomnia: true, bruno: 'Partial', robot: 'Via library', cucumber: 'Via code', jmeter: 'Plugins', neoload: 'Partial' },
  },
  {
    feature: 'GraphQL',
    values: { multimeter: true, postman: true, insomnia: true, bruno: true, robot: 'Via library', cucumber: 'Via code', jmeter: 'Plugins', neoload: 'Partial' },
  },
  {
    feature: 'gRPC',
    values: { multimeter: true, postman: true, insomnia: true, bruno: false, robot: 'Via library', cucumber: 'Via code', jmeter: 'Plugins', neoload: 'Partial' },
  },
  {
    feature: 'CI/CD CLI',
    values: { multimeter: true, postman: true, insomnia: true, bruno: true, robot: true, cucumber: true, jmeter: true, neoload: true },
  },
  {
    feature: 'Load Testing',
    values: { multimeter: 'Beta', postman: 'Limited', insomnia: false, bruno: false, robot: 'Via library', cucumber: 'Via code', jmeter: true, neoload: true },
  },
  {
    feature: 'Git-Native Files',
    values: { multimeter: true, postman: false, insomnia: false, bruno: true, robot: true, cucumber: true, jmeter: 'XML', neoload: false },
  },
  {
    feature: 'Drag & Drop Test Builder',
    values: { multimeter: true, postman: false, insomnia: false, bruno: false, robot: false, cucumber: false, jmeter: true, neoload: true },
  },
  {
    feature: 'Functional Test Flows',
    values: { multimeter: true, postman: 'Scripts', insomnia: 'Scripts', bruno: 'Scripts', robot: true, cucumber: true, jmeter: true, neoload: true },
  },
  {
    feature: 'Test Suites (Parallel / Sequential)',
    values: { multimeter: true, postman: 'Sequential', insomnia: false, bruno: false, robot: true, cucumber: true, jmeter: true, neoload: true },
  },
  {
    feature: 'Reusing / Chaining Tests',
    values: { multimeter: true, postman: false, insomnia: false, bruno: false, robot: true, cucumber: true, jmeter: true, neoload: true },
  },
  {
    feature: 'Data Extraction (JSONPath/XPath/Regex)',
    values: { multimeter: true, postman: 'Scripting', insomnia: 'Scripting', bruno: 'Scripting', robot: 'Via library', cucumber: 'Via code', jmeter: true, neoload: true },
  },
  {
    feature: 'AI Test Generation',
    values: { multimeter: true, postman: true, insomnia: false, bruno: false, robot: false, cucumber: false, jmeter: false, neoload: false },
  },
  {
    feature: 'Declarative Test Flows (YAML)',
    values: { multimeter: true, postman: false, insomnia: false, bruno: false, robot: false, cucumber: false, jmeter: false, neoload: false },
  },
  {
    feature: 'BDD / Human-Readable Specs',
    values: { multimeter: true, postman: false, insomnia: false, bruno: false, robot: true, cucumber: true, jmeter: false, neoload: false },
  },
  {
    feature: 'Interactive API Docs (HTML)',
    values: { multimeter: true, postman: false, insomnia: false, bruno: false, robot: false, cucumber: false, jmeter: false, neoload: false },
  },
  {
    feature: 'Mock Server',
    values: { multimeter: true, postman: 'Cloud only', insomnia: false, bruno: false, robot: false, cucumber: false, jmeter: false, neoload: false },
  },
  {
    feature: 'Environment Variables / Presets',
    values: { multimeter: true, postman: true, insomnia: true, bruno: true, robot: 'Variables', cucumber: 'Via code', jmeter: true, neoload: true },
  },
  {
    feature: 'Dynamic Tokens (random, date, uuid)',
    values: { multimeter: true, postman: true, insomnia: false, bruno: false, robot: 'Via library', cucumber: 'Via code', jmeter: true, neoload: true },
  },
  {
    feature: 'JS Helper Module Imports',
    values: { multimeter: true, postman: false, insomnia: false, bruno: false, robot: false, cucumber: false, jmeter: false, neoload: false },
  },
  {
    feature: 'CSV Data-Driven Testing',
    values: { multimeter: true, postman: true, insomnia: false, bruno: false, robot: true, cucumber: true, jmeter: true, neoload: true },
  },
  {
    feature: 'HTML Report',
    values: { multimeter: true, postman: true, insomnia: false, bruno: false, robot: true, cucumber: true, jmeter: true, neoload: true },
  },
  {
    feature: 'Markdown Report',
    values: { multimeter: true, postman: false, insomnia: false, bruno: false, robot: false, cucumber: true, jmeter: false, neoload: false },
  },
  {
    feature: 'JUnit Report',
    values: { multimeter: true, postman: true, insomnia: false, bruno: false, robot: true, cucumber: true, jmeter: true, neoload: true },
  },
  {
    feature: 'Fully Offline',
    values: { multimeter: true, postman: false, insomnia: true, bruno: true, robot: true, cucumber: true, jmeter: true, neoload: true },
  },
]

function CellValue({ value }: { value: Cell }) {
  if (typeof value === 'string') {
    return <span className="text-[10px] leading-tight">{value}</span>
  }
  if (value) {
    return <Check size={14} className="text-green-400 mx-auto" />
  }
  return <X size={14} className="text-red-400/60 mx-auto" />
}

export default function Comparison() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-light/30">
      <div className="max-w-7xl mx-auto">
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
            <table className="w-full min-w-[1080px]">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="sticky left-0 z-10 bg-surface text-left px-3 py-2.5 text-xs font-medium text-slate-400 min-w-44">
                    Feature
                  </th>
                  {tools.map((tool) => (
                    <th key={tool.key} className="px-2 py-2.5 text-center min-w-24">
                      <div className="flex flex-col items-center gap-1">
                        <img src={tool.logo} alt={tool.name} className="w-4 h-4 object-contain" />
                        <span className={`text-[10px] font-semibold leading-tight ${tool.highlight ? 'text-primary-light' : 'text-slate-400'}`}>
                          {tool.name}
                        </span>
                      </div>
                    </th>
                  ))}
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
                    <td className={`sticky left-0 z-10 px-3 py-2 text-xs text-slate-300 ${
                      index % 2 === 0 ? 'bg-surface-light' : 'bg-surface'
                    }`}>
                      {row.feature}
                    </td>
                    {tools.map((tool) => (
                      <td
                        key={tool.key}
                        className={`px-2 py-2 text-center ${tool.highlight ? 'text-green-400 font-medium' : 'text-slate-400'}`}
                      >
                        <CellValue value={row.values[tool.key]} />
                      </td>
                    ))}
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
