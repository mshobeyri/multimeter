import { Check, FileCode, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import FadeIn from '../components/FadeIn'
import type { CompareCell } from '../data/comparePages'

type ToolKey = 'multimeter' | 'postman' | 'bruno' | 'restClient'

interface FeatureRow {
  feature: string
  values: Record<ToolKey, CompareCell>
}

const tools: Array<{ key: ToolKey; name: string; logo?: string; highlight?: boolean }> = [
  { key: 'multimeter', name: 'Multimeter', logo: '/logo.svg', highlight: true },
  { key: 'postman', name: 'Postman', logo: '/competitors/postman.svg' },
  { key: 'bruno', name: 'Bruno', logo: '/competitors/bruno.svg' },
  { key: 'restClient', name: 'REST Client' },
]

const features: FeatureRow[] = [
  {
    feature: 'Where files live',
    values: {
      multimeter: 'Git YAML (.mmt)',
      postman: 'Cloud collections',
      bruno: 'Git (.bru)',
      restClient: '.http files',
    },
  },
  {
    feature: 'Editor UI',
    values: {
      multimeter: 'VS Code visual editor',
      postman: 'Desktop / web app',
      bruno: 'Desktop app',
      restClient: '.http text',
    },
  },
  {
    feature: 'VS Code native',
    values: { multimeter: true, postman: false, bruno: false, restClient: false },
  },
  {
    feature: 'Same files in CI',
    values: {
      multimeter: 'testlight / Action',
      postman: 'Newman',
      bruno: 'bru CLI',
      restClient: false,
    },
  },
  {
    feature: 'Open specs without converting',
    values: {
      multimeter: 'Open as MMT',
      postman: 'N/A',
      bruno: 'Import',
      restClient: false,
    },
  },
  {
    feature: 'Tests and suites',
    values: {
      multimeter: true,
      postman: 'Scripts',
      bruno: 'Limited',
      restClient: false,
    },
  },
  {
    feature: 'Parallel runs',
    values: {
      multimeter: 'Tests and suites',
      postman: 'No (Newman sequential)',
      bruno: 'Sequential',
      restClient: false,
    },
  },
  {
    feature: 'Call cache',
    values: {
      multimeter: 'Reuse setup in a run',
      postman: false,
      bruno: false,
      restClient: false,
    },
  },
  {
    feature: 'Sequential CLI speed',
    values: {
      multimeter: '~10% faster than Newman',
      postman: 'Newman',
      bruno: '—',
      restClient: '—',
    },
  },
  {
    feature: 'AI judges fuzzy replies',
    values: {
      multimeter: true,
      postman: false,
      bruno: false,
      restClient: false,
    },
  },
  {
    feature: 'Local mock server',
    values: { multimeter: true, postman: 'Cloud (paid)', bruno: false, restClient: false },
  },
  {
    feature: 'Account required',
    values: { multimeter: 'No', postman: 'For teams', bruno: 'No', restClient: 'No' },
  },
  {
    feature: 'License',
    values: {
      multimeter: 'Apache 2.0',
      postman: 'Proprietary',
      bruno: 'Open core',
      restClient: 'MIT',
    },
  },
]

function CellValue({ value }: { value: CompareCell }) {
  if (typeof value === 'string') {
    return (
      <span className="inline-block max-w-[10rem] text-[13px] leading-snug text-slate-300">
        {value}
      </span>
    )
  }
  if (value) {
    return <Check size={18} className="text-emerald-400 mx-auto" />
  }
  return <X size={16} className="text-slate-600 mx-auto" />
}

function ToolMark({ tool }: { tool: (typeof tools)[number] }) {
  if (tool.logo) {
    return <img src={tool.logo} alt="" className="w-6 h-6 object-contain" />
  }
  return <FileCode size={20} className="text-slate-400" />
}

export default function Comparison() {
  return (
    <section id="comparison" className="scroll-mt-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              How Multimeter compares
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Files in Git, inside VS Code — not a cloud collection or a second desktop app.
            </p>
            <p className="text-sm text-slate-500 mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3">
              <Link to="/compare/postman" className="text-primary-light hover:text-white">vs Postman</Link>
              <Link to="/compare/bruno" className="text-primary-light hover:text-white">vs Bruno</Link>
              <Link to="/compare/rest-client" className="text-primary-light hover:text-white">vs REST Client</Link>
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#101827] shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="sticky left-0 z-10 bg-[#1a2336] text-left px-5 py-4 text-xs font-medium uppercase tracking-wider text-slate-500 min-w-44">
                    Feature
                  </th>
                  {tools.map((tool) => (
                    <th
                      key={tool.key}
                      className={`px-4 py-4 text-center min-w-[8.5rem] ${
                        tool.highlight
                          ? 'bg-indigo-500/15 border-x border-indigo-400/20'
                          : 'bg-[#1a2336]'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <ToolMark tool={tool} />
                        <span className={`text-sm font-semibold ${tool.highlight ? 'text-white' : 'text-slate-300'}`}>
                          {tool.name}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((row, index) => {
                  const zebra = index % 2 === 0 ? 'bg-[#151d2f]' : 'bg-[#101827]'
                  return (
                    <tr key={row.feature} className={`border-b border-white/5 last:border-0 ${zebra}`}>
                      <td className={`sticky left-0 z-10 px-5 py-3.5 text-sm text-slate-200 ${zebra}`}>
                        {row.feature}
                      </td>
                      {tools.map((tool) => (
                        <td
                          key={tool.key}
                          className={`px-4 py-3.5 text-center ${
                            tool.highlight
                              ? 'bg-indigo-500/10 text-white border-x border-indigo-400/15'
                              : 'text-slate-400'
                          }`}
                        >
                          <CellValue value={row.values[tool.key]} />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
