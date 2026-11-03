import { Check, CircleHelp, FileCode, X } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import FadeIn from '../components/FadeIn'
import type { CompareCell } from '../data/comparePages'

type ToolKey = 'multimeter' | 'postman' | 'bruno' | 'restClient'

interface FeatureRow {
  feature: string
  /** Hover explanation for features that need more than a label. */
  help?: string
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
    feature: 'Version control',
    help: 'Multimeter, Bruno, and REST Client keep definitions as files in Git. Postman is cloud-collection first — you export/import JSON or use Git Sync, so the workspace collection is still the primary unit of work.',
    values: {
      multimeter: 'Git',
      postman: 'Cloud / export JSON',
      bruno: 'Git',
      restClient: 'Git',
    },
  },

  {
    feature: 'Editor UI',
    help: 'Multimeter: send requests and run tests without leaving VS Code — visual editor and YAML stay side by side. Postman and Bruno are separate apps. REST Client is plain .http text.',
    values: {
      multimeter: 'Stay in VS Code',
      postman: 'Desktop / web app',
      bruno: 'Detached desktop app',
      restClient: '.http text',
    },
  },
  {
    feature: 'Same files in CI',
    help: 'Multimeter runs the same .mmt files locally and in CI via Testlight / the GitHub Action. Postman uses Newman; Bruno has bru CLI. REST Client has no first-class runner.',
    values: {
      multimeter: 'Testlight / Action',
      postman: 'Newman',
      bruno: 'bru CLI',
      restClient: false,
    },
  },
  {
    feature: 'File layout',
    help: 'Multimeter uses small YAML files — each API, test, or suite has one duty — so humans and AI open only the topic they need. Postman is usually one large collection JSON. Bruno is one .bru per request. REST Client keeps requests in .http files.',
    values: {
      multimeter: 'Use distributed YAML files',
      postman: 'Large collection JSON',
      bruno: 'One .bru per request',
      restClient: '.http files',
    },
  },

  {
    feature: 'Orchestration',
    help: 'Multimeter uses suites to control which items run and in what order (including parallel groups). That gives AI a clear run graph. Postman organizes work as collections; Bruno’s runner is mostly sequential folders.',
    values: {
      multimeter: 'Suites',
      postman: 'Collections',
      bruno: 'Folders',
      restClient: false,
    },
  },

  {
    feature: 'Declarative test flow',
    help: 'Multimeter tests are declarative steps (call, expect, assert, check) in YAML. Postman leans on scripts (pm.test). Bruno uses JS for anything non-trivial. REST Client has minimal asserts.',
    values: {
      multimeter: true,
      postman: 'Scripts',
      bruno: 'JS for logic',
      restClient: false,
    },
  },
  {
    feature: 'Parallel runs / call cache',
    help: 'Multimeter parallelizes suite groups and test stages by default, and can reuse login/setup calls in the same run. Postman (Newman) and Bruno runners stay largely sequential.',
    values: { multimeter: true, postman: false, bruno: false, restClient: false },
  },
  {
    feature: 'AI judge',
    help: 'Multimeter can score non-deterministic replies (similarity, relevance, open-ended checks) with a model you choose, in the same test flow. Not a separate eval product.',
    values: {
      multimeter: true,
      postman: false,
      bruno: false,
      restClient: false,
    },
  },
  {
    feature: 'Local mock server',
    help: 'Multimeter ships a local mock server from YAML (including WebSocket). Postman mocks are cloud/paid. Bruno and REST Client do not include one.',
    values: { multimeter: true, postman: 'Cloud (paid)', bruno: false, restClient: false },
  },
  {
    feature: 'Open specs without converting',
    help: 'Multimeter can open OpenAPI, Postman, Bruno, .http, and WSDL as MMT in a split editor and run them without a full convert. Others typically import or stay in their native format only.',
    values: {
      multimeter: 'Open as MMT',
      postman: 'N/A',
      bruno: 'Import',
      restClient: false,
    },
  },
  {
    feature: 'Account required',
    values: { multimeter: 'No', postman: 'For teams', bruno: 'No', restClient: 'No' },
  },
  {
    feature: 'License',
    help: 'Multimeter is Apache 2.0 end-to-end. Postman is proprietary. Bruno is open core (paid extras). REST Client is MIT.',
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

function FeatureHelpTip({
  tipId,
  help,
  anchor,
}: {
  tipId: string
  help: string
  anchor: DOMRect
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) {
      return
    }
    const height = node.offsetHeight
    const width = node.offsetWidth
    // Sit to the right of the help icon, vertically centered on it.
    const top = Math.max(8, Math.min(anchor.top + anchor.height / 2 - height / 2, window.innerHeight - height - 8))
    const left = Math.min(anchor.right + 10, window.innerWidth - width - 8)
    node.style.top = `${top}px`
    node.style.left = `${Math.max(8, left)}px`
  }, [anchor, help])

  return createPortal(
    <span id={tipId} ref={ref} role="tooltip" className="mmt-compare-tip">
      {help}
    </span>,
    document.body,
  )
}

function FeatureLabel({ feature, help }: { feature: string; help?: string }) {
  const tipId = useId()
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  if (!help) {
    return <>{feature}</>
  }

  const showTip = (el: HTMLElement) => {
    setAnchor(el.getBoundingClientRect())
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{feature}</span>
      <button
        type="button"
        className="inline-flex shrink-0 rounded-full text-slate-400 hover:text-white focus:outline-none focus-visible:text-white"
        aria-label={`About ${feature}`}
        aria-describedby={anchor ? tipId : undefined}
        onMouseEnter={(e) => {
          showTip(e.currentTarget)
        }}
        onMouseLeave={() => {
          setAnchor(null)
        }}
        onFocus={(e) => {
          showTip(e.currentTarget)
        }}
        onBlur={() => {
          setAnchor(null)
        }}
      >
        <CircleHelp size={15} strokeWidth={2.25} className="opacity-90" />
      </button>
      {anchor ? <FeatureHelpTip tipId={tipId} help={help} anchor={anchor} /> : null}
    </span>
  )
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
                        <FeatureLabel feature={row.feature} help={row.help} />
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
