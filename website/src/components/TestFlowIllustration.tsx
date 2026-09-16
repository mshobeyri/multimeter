import Codicon from './Codicon'
import VSCodeDemoFrame, {
  VSCodeEditorTabs,
} from './VSCodeDemoFrame'

type FlowRow = {
  label: string
  detail: string
  depth: number
  icon: string
}

const FLOW_ROWS: FlowRow[] = [
  { label: 'call', detail: 'login', depth: 0, icon: 'debug-start' },
  { label: 'assert', detail: 'login.status == 200', depth: 0, icon: 'check' },
  { label: 'for', detail: 'user of users', depth: 0, icon: 'sync' },
  { label: 'call', detail: 'getProfile', depth: 1, icon: 'debug-start' },
  { label: 'check', detail: 'profile.name == user.name', depth: 1, icon: 'check' },
]

function FlowPanel() {
  return (
    <div className="flex flex-1 flex-col min-w-0 border-t border-border sm:border-t-0 bg-surface text-left">
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-0 overflow-x-auto">
          {[
            { label: 'Overview', icon: 'note', active: false },
            { label: 'Flow', icon: 'type-hierarchy-sub', active: true },
            { label: 'Code', icon: 'code', active: false },
          ].map((tab) => (
            <div
              key={tab.label}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] sm:text-[11px] font-medium shrink-0 ${
                tab.active
                  ? 'text-slate-200 border-b border-slate-200'
                  : 'text-slate-500 opacity-60'
              }`}
            >
              <Codicon name={tab.icon} className="text-xs" />
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Steps</div>
        <div className="space-y-1.5">
          {FLOW_ROWS.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className="rounded-lg border border-border bg-surface-light/45 px-3 py-1.5"
              style={{ marginLeft: `${row.depth * 16}px` }}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-slate-400">
                  <Codicon name={row.icon} className="text-[11px]" />
                </span>
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{row.label}</span>
                  <span className="text-xs sm:text-sm text-slate-200 truncate">{row.detail}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TestFlowIllustration() {
  return (
    <VSCodeDemoFrame minHeightClass="min-h-[360px] sm:min-h-[400px]">
      <VSCodeEditorTabs tabs={[{ id: 'flow', label: 'login-flow.mmt', icon: 'beaker', active: true }]} />
      <div className="flex flex-1 min-h-0">
        <FlowPanel />
      </div>
    </VSCodeDemoFrame>
  )
}
