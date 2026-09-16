import Codicon from './Codicon'
import VSCodeDemoFrame, {
  VSCodeEditorTabs,
  YamlEditorPane,
} from './VSCodeDemoFrame'

const GENERATED_TEST = [
  'type: test',
  'title: Service API',
  'steps:',
  '  - http: http://localhost:8000/health',
  '    title: Health check',
  '    expect:',
  '      status: 200',
  '      body.status: ok',
  '  - http: http://localhost:8000/users',
  '    title: Create user',
  '    method: post',
  '    body:',
  '      name: Ada',
  '    expect:',
  '      status: 201',
  '      body.name: Ada',
]

const COPILOT_PROMPT = 'Write a test for this code'

function CopilotIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={`shrink-0 ${className}`} aria-hidden="true">
      <path
        d="M14 0C6.27 0 0 6.27 0 14s6.27 14 14 14 14-6.27 14-14S21.73 0 14 0zm6.59 17.15c-.37 1.27-1.7 2.35-3.2 2.65-.5.1-.85-.3-.7-.78.13-.4.52-.66.94-.78 1.04-.29 1.78-.93 1.98-1.63.3-1.02-.4-2.06-1.86-2.8l-.3-.14c-1.8-.83-2.93-1.99-2.93-3.67 0-.62.17-1.2.47-1.71.08-.14-.02-.32-.18-.3-2.77.5-4.74 2.37-4.74 4.82 0 .99.3 1.9.8 2.67.12.2-.04.45-.27.38-1.02-.32-1.87-.98-2.35-1.88-.1-.19-.4-.17-.44.05-.04.22-.06.44-.06.67 0 1.7.94 3.18 2.34 3.97.2.1.18.4-.04.44-.46.07-.94.07-1.4-.01-.2-.04-.36.17-.24.34.84 1.22 2.27 2.04 3.88 2.12.14.01.22.17.13.28-1.28 1.3-3.1 2.05-5.07 2.05-.35 0-.69-.02-1.03-.06-.18-.02-.3.2-.14.33A13.93 13.93 0 0 0 14 25.5c7.18 0 11.5-5.98 11.5-11.18 0-.17 0-.34-.01-.51a8.26 8.26 0 0 0 2.01-2.1c.14-.2-.06-.46-.28-.37-.75.3-1.55.5-2.39.58a4.15 4.15 0 0 0 1.83-2.29c.08-.22-.17-.41-.37-.28-.87.54-1.82.93-2.84 1.14A4.13 4.13 0 0 0 20.6 9.2c-2.28 0-4.13 1.85-4.13 4.13 0 .32.04.64.11.94-3.44-.17-6.49-1.82-8.53-4.32-.12-.14-.35-.12-.42.06a4.14 4.14 0 0 0 1.28 4.82"
        fill="currentColor"
        className="text-purple-400"
      />
    </svg>
  )
}

function CopilotChatPanel() {
  return (
    <div className="flex flex-col flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-border bg-surface text-left">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <CopilotIcon size={14} />
          <span className="text-xs sm:text-sm font-medium text-slate-200">Chat</span>
        </div>
        <div className="flex items-center gap-0.5 text-slate-500">
          <span className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/5">
            <Codicon name="add" className="text-sm" />
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/5">
            <Codicon name="history" className="text-sm" />
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/5">
            <Codicon name="ellipsis" className="text-sm" />
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 sm:px-4 py-4 space-y-5">
        <div className="flex justify-end">
          <div className="max-w-[88%] rounded-xl border border-border/80 px-3 py-2.5">
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed text-left">{COPILOT_PROMPT}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 justify-end">
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-slate-300">
                <Codicon name="file" className="text-xs text-sky-400" />
                service.py
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/15">
              <CopilotIcon size={14} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5 space-y-2">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                I read your FastAPI service and scaffolded a test for the health and user endpoints.
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-light/60 px-2.5 py-1.5 text-[11px] sm:text-xs text-slate-200 hover:bg-surface-light"
              >
                <Codicon name="beaker" className="text-sm text-emerald-400" />
                service_test.mmt
                <Codicon name="chevron-right" className="text-[10px] text-slate-500" />
              </button>
              <p className="text-[11px] text-slate-500">Validated and ready to run via MCP.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-3">
        <div className="rounded-xl border border-border bg-surface-light/60">
          <div className="px-3 pt-3 pb-2 min-h-[52px]">
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{COPILOT_PROMPT}</p>
          </div>
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-white/5">
                <Codicon name="add" className="text-sm" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-white/5">
                <CopilotIcon size={12} />
                Agent
                <Codicon name="chevron-down" className="text-[10px]" />
              </span>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white shadow-sm">
              <Codicon name="arrow-up" className="text-sm" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AIIllustration() {
  return (
    <VSCodeDemoFrame minHeightClass="min-h-[520px] sm:min-h-[580px]">
      <VSCodeEditorTabs
        tabs={[
          { id: 'test', label: 'service_test.mmt', icon: 'beaker', active: true },
          { id: 'service', label: 'service.py', icon: 'file', active: false },
        ]}
      />
      <div className="flex flex-col sm:flex-row flex-1 min-h-0">
        <YamlEditorPane lines={GENERATED_TEST} />
        <CopilotChatPanel />
      </div>
    </VSCodeDemoFrame>
  )
}
