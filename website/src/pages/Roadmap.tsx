import FadeIn from '../components/FadeIn'
import { Check, Clock, Circle } from 'lucide-react'

type ItemStatus = 'done' | 'in-progress' | 'planned'

interface RoadmapItem {
  title: string
  status: ItemStatus
}

interface RoadmapMonth {
  month: string
  year: number
  items: RoadmapItem[]
}

const roadmap: RoadmapMonth[] = [
  {
    month: 'November',
    year: 2025,
    items: [
      { title: 'HTTP / REST API testing', status: 'done' },
      { title: 'WebSocket support', status: 'done' },
      { title: 'YAML visual editor for .mmt files', status: 'done' },
      { title: 'Test flows with call, assert, check, delay', status: 'done' },
      { title: 'Input / output extraction (JSONPath, XPath, Regex)', status: 'done' },
      { title: 'Environment variables & presets', status: 'done' },
      { title: 'Import Postman collections & OpenAPI specs', status: 'done' },
      { title: 'Auto-generated API documentation (HTML & Markdown)', status: 'done' },
    ],
  },
  {
    month: 'December',
    year: 2025,
    items: [
      { title: 'Version 1.0 release', status: 'done' },
      { title: 'AI assistant (@Multimeter chat participant)', status: 'done' },
      { title: 'Curl command import & execution', status: 'done' },
      { title: 'Test suite (type: suite)', status: 'done' },
      { title: 'Drag & drop test flow builder', status: 'done' },
      { title: 'Certificate management panel', status: 'done' },
      { title: 'Run button glyphs in YAML', status: 'done' },
      { title: 'History panel', status: 'done' },
      { title: 'File picker for imports & suite items', status: 'done' },
    ],
  },
  {
    month: 'January',
    year: 2026,
    items: [
      { title: 'Suite bundle runner with parallel groups', status: 'done' },
      { title: 'Suite hierarchy UI with tree view', status: 'done' },
      { title: 'Test autocomplete (call, check, assert)', status: 'done' },
      { title: 'Input auto complete', status: 'done' },
      { title: 'Major UI overhaul (API, test, suite panels)', status: 'done' },
      { title: 'Environment presets table & config file', status: 'done' },
      { title: 'Import files from workspace root (+/)', status: 'done' },
      { title: 'Report success field for assertions', status: 'done' },
    ],
  },
  {
    month: 'February',
    year: 2026,
    items: [
      { title: 'Mock server with history', status: 'done' },
      { title: 'HTTPS & self-signed certificate handling', status: 'done' },
      { title: 'Connection tracker panel', status: 'done' },
      { title: 'Set environment variable step (setenv)', status: 'done' },
      { title: 'External code execution in tests', status: 'done' },
      { title: 'Interactive API docs with try-it & CORS', status: 'done' },
      { title: 'Test input / output definitions', status: 'done' },
      { title: 'CLI testlight improvements', status: 'done' },
      { title: 'Official website launch', status: 'done' },
    ],
  },
  {
    month: 'March',
    year: 2026,
    items: [
      { title: 'Suite environment & export fields', status: 'done' },
      { title: 'Auto-generate reports from suites (JUnit, HTML, Markdown, MMT)', status: 'done' },
      { title: 'Suite overview section (pass/fail/skip counts)', status: 'done' },
      { title: 'Mock server in tests (run step)', status: 'done' },
      { title: '4-tab suite edit panel (Tests, Servers, Environment, Exports)', status: 'done' },
      { title: 'Report format toggle & duration tracking', status: 'done' },
      { title: 'Website: mock server & reports sections, Robot Framework comparison', status: 'done' },
    ],
  },
  {
    month: 'April',
    year: 2026,
    items: [
      { title: 'gRPC protocol support', status: 'in-progress' },
      { title: 'Proto file import & service discovery', status: 'planned' },
      { title: 'gRPC streaming (unary, server, client, bidi)', status: 'planned' },
      { title: 'Load testing & performance reports', status: 'planned' },
      { title: 'Test coverage visualization', status: 'planned' },
    ],
  },
  {
    month: 'May',
    year: 2026,
    items: [
      { title: 'GraphQL protocol support', status: 'planned' },
      { title: 'Schema introspection & auto complete', status: 'planned' },
      { title: 'Scheduled test runs', status: 'planned' },
      { title: 'Team collaboration features', status: 'planned' },
    ],
  },
]

const statusConfig: Record<ItemStatus, { icon: typeof Check; color: string; bg: string; label: string }> = {
  done: { icon: Check, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Shipped' },
  'in-progress': { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'In Progress' },
  planned: { icon: Circle, color: 'text-slate-500', bg: 'bg-slate-500/10', label: 'Planned' },
}

export default function Roadmap() {
  return (
    <div className="pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
              Roadmap
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              What we&apos;ve shipped and what&apos;s coming next. Built in public, driven by the community.
            </p>
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-6">
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <cfg.icon size={14} className={cfg.color} />
                  <span className="text-slate-400">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border hidden sm:block" />

          <div className="space-y-12">
            {[...roadmap].reverse().map((month, mi) => {
              const allDone = month.items.every((i) => i.status === 'done')
              const hasInProgress = month.items.some((i) => i.status === 'in-progress')

              return (
                <FadeIn key={`${month.month}-${month.year}`} delay={mi * 80}>
                  <div className="flex gap-6">
                    {/* Timeline dot */}
                    <div className="hidden sm:flex flex-col items-center shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 bg-surface ${
                          allDone
                            ? 'border-green-400'
                            : hasInProgress
                              ? 'border-yellow-400'
                              : 'border-slate-600'
                        }`}
                      >
                        {allDone ? (
                          <Check size={18} className="text-green-400" />
                        ) : hasInProgress ? (
                          <Clock size={18} className="text-yellow-400" />
                        ) : (
                          <Circle size={18} className="text-slate-500" />
                        )}
                      </div>
                    </div>

                    {/* Content card */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-white mb-1">
                        {month.month} {month.year}
                      </h3>
                      <div className="bg-surface-light border border-border rounded-xl p-5 mt-3">
                        <ul className="space-y-3">
                          {month.items.map((item) => {
                            const cfg = statusConfig[item.status]
                            return (
                              <li key={item.title} className="flex items-start gap-3">
                                <div className={`mt-0.5 w-6 h-6 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                                  <cfg.icon size={14} className={cfg.color} />
                                </div>
                                <span
                                  className={
                                    item.status === 'done'
                                      ? 'text-slate-400'
                                      : item.status === 'in-progress'
                                        ? 'text-white font-medium'
                                        : 'text-slate-300'
                                  }
                                >
                                  {item.title}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
