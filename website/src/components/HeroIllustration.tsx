import { useCallback, useState } from 'react'
import Codicon from './Codicon'
import VSCodeDemoFrame, {
  VSCodeEditorTabs,
  VSCodeSidePanel,
  YamlLine,
} from './VSCodeDemoFrame'
import type { VSCodeEditorTab } from './VSCodeDemoFrame'

type DemoTabId = 'api' | 'test' | 'suite'

interface DemoTab {
  id: DemoTabId
  label: string
  icon: string
  yaml: string[]
}

const ECHO_MMT = `type: api
url: https://test.mmt.dev/echo
method: post
format: json
body:
  message: hello`

const DEMO_TABS: DemoTab[] = [
  {
    id: 'api',
    label: 'echo.mmt',
    icon: 'file',
    yaml: ECHO_MMT.split('\n'),
  },
  {
    id: 'test',
    label: 'test.mmt',
    icon: 'beaker',
    yaml: [
      'type: test',
      'steps:',
      '  - http: https://test.mmt.dev/echo',
      '    title: Send an echo request',
      '    method: post',
      '    body:',
      '      message: hello',
      '    expect:',
      '      status: 200',
      '      body.body.message: hello',
    ],
  },
  {
    id: 'suite',
    label: 'suite.mmt',
    icon: 'layers',
    yaml: [
      'type: suite',
      'tests:',
      '  - test/login.mmt',
      '  - test/echo_test.mmt',
      '  - test/status_test.mmt',
    ],
  },
]

const REQUEST_BODY_LINES = [
  '{',
  '  "message": "hello"',
  '}',
]

const RESPONSE_BODY_LINES = [
  '{',
  '  "method": "POST",',
  '  "url": "https://test.mmt.dev/echo",',
  '  "path": "/echo",',
  '  "headers": {',
  '    "content-type": "application/json"',
  '  },',
  '  "body": {',
  '    "message": "hello"',
  '  }',
  '}',
]

/** Match mmtview API tester request tabs (settings is icon-only). */
const REQUEST_TABS = [
  { label: 'Auth' },
  { label: 'Params' },
  { label: 'Headers' },
  { label: 'Body', active: true },
  { label: 'Cookies' },
  { label: 'Inputs' },
  { label: 'Doc' },
  { label: 'Settings', icon: 'settings-gear' },
] as const

const RESPONSE_TABS = [
  { label: 'Body', active: true },
  { label: 'Headers' },
  { label: 'Cookies' },
  { label: 'Outputs' },
] as const

/** Brand POST accent from mmtview `METHOD_PROTOCOL_COLORS.post`. */
const POST_ACCENT = '#49cc90'

function YamlPanel({
  tab,
  copied,
  onCopy,
}: {
  tab: DemoTab
  copied: boolean
  onCopy: () => void
}) {
  const action = tab.id === 'test' ? 'Run' : 'Send'
  const showFooter = tab.id === 'api' || tab.id === 'test'

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-[240px] sm:min-h-0 bg-[#0b1220]">
      <div className="flex-1 overflow-auto p-3 sm:p-4 font-mono text-[11px] sm:text-xs leading-6 text-left">
        {tab.yaml.map((line, i) => {
          const colonIdx = line.indexOf(':')
          return (
            <div key={i} className="grid grid-cols-[2.25rem_minmax(0,1fr)] whitespace-pre">
              <span className="select-none text-right pr-3 text-slate-600">{i + 1}</span>
              {colonIdx === -1 ? (
                <span className="text-slate-300">{line}</span>
              ) : (
                <YamlLine line={line} colonIdx={colonIdx} />
              )}
            </div>
          )
        })}
      </div>
      {showFooter ? (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border text-[11px] sm:text-xs text-slate-500 text-left">
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white"
          >
            <Codicon name={copied ? 'check' : 'copy'} className={copied ? 'text-emerald-400' : ''} />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span>and paste into VS Code and click {action}.</span>
        </div>
      ) : null}
    </div>
  )
}

function JsonBlock({ lines }: { lines: string[] }) {
  return (
    <div className="px-3 py-2 font-mono text-[10px] sm:text-xs leading-5 text-left">
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre">
          {line.includes('"') ? (
            <>
              {line.split(/("[^"]*")/).map((part, j) =>
                part.startsWith('"') ? (
                  <span key={j} className={j === 1 ? 'text-primary-light' : 'text-accent'}>
                    {part}
                  </span>
                ) : (
                  <span key={j} className="text-slate-500">{part}</span>
                )
              )}
            </>
          ) : (
            <span className="text-slate-500">{line}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function TabStrip({
  tabs,
}: {
  tabs: ReadonlyArray<{ label: string; active?: boolean; icon?: string }>
}) {
  return (
    <div className="flex items-center gap-0 min-w-0 overflow-x-auto">
      {tabs.map((tab) => {
        const active = Boolean(tab.active)
        return (
          <div
            key={tab.label}
            className={`flex items-center gap-1 px-2 py-1.5 text-[10px] sm:text-[11px] font-medium shrink-0 ${
              active
                ? 'text-slate-200 border-b border-slate-200'
                : 'text-slate-500 opacity-60'
            }`}
            title={tab.icon ? tab.label : undefined}
            aria-label={tab.icon ? tab.label : undefined}
          >
            {tab.icon ? <Codicon name={tab.icon} className="text-xs" /> : tab.label}
          </div>
        )
      })}
    </div>
  )
}

/** Circular send/run + more chevron — mirrors mmtview SendButton. */
function ActionControl({
  mode,
  title,
}: {
  mode: 'send' | 'run'
  title?: string
}) {
  const label = title ?? (mode === 'run' ? 'Run' : 'Send')
  const icon = mode === 'run' ? 'run' : 'send'
  return (
    <div
      className="inline-flex h-[28px] shrink-0 overflow-hidden rounded-full border shadow-lg shadow-emerald-500/15"
      style={{
        backgroundColor: `color-mix(in oklab, ${POST_ACCENT} 52%, #0b1220)`,
        borderColor: `color-mix(in oklab, ${POST_ACCENT} 55%, transparent)`,
      }}
      title={label}
    >
      <span className="flex w-[28px] items-center justify-center">
        <Codicon name={icon} className={`text-white text-sm${mode === 'send' ? ' ml-0.5' : ''}`} />
      </span>
      <span
        className="w-px self-stretch my-1"
        style={{ backgroundColor: 'color-mix(in srgb, white 45%, transparent)' }}
        aria-hidden
      />
      <span className="flex w-5 items-center justify-center">
        <Codicon name="chevron-down" className="text-white text-[11px]" />
      </span>
    </div>
  )
}

function ApiPanel() {
  return (
    <div className="flex-1 flex flex-col min-w-0 border-t sm:border-t-0 sm:border-l border-border text-left bg-surface">
      {/* Fixed header: method+URL pill + Send (matches apitest-url-row) */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-2">
        <div className="flex flex-1 min-w-0 h-7 items-stretch overflow-hidden rounded-full border border-border bg-[#0b1220]">
          <span
            className="flex w-[4.5rem] shrink-0 items-center justify-center text-[10px] sm:text-[11px] font-semibold text-white"
            style={{
              backgroundColor: `color-mix(in oklab, ${POST_ACCENT} 52%, #0b1220)`,
            }}
          >
            POST
          </span>
          <div className="flex-1 min-w-0 px-2.5 flex items-center text-[10px] sm:text-xs text-slate-300 font-mono truncate">
            https://test.mmt.dev/echo
          </div>
        </div>
        <ActionControl mode="send" />
      </div>

      {/* Request tabs */}
      <div className="flex items-center gap-2 px-2 border-b border-border">
        <div className="min-w-0 flex-1">
          <TabStrip tabs={REQUEST_TABS} />
        </div>
      </div>

      <div className="min-h-[72px] flex-1 overflow-hidden">
        <JsonBlock lines={REQUEST_BODY_LINES} />
      </div>

      {/* Response tabs + duration / status / tools (matches apitest-response-tabs-row) */}
      <div className="flex items-center gap-2 px-2 border-t border-b border-border min-h-8">
        <div className="min-w-0 flex-1">
          <TabStrip tabs={RESPONSE_TABS} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-[11px] text-slate-300 whitespace-nowrap">142ms</span>
          <span
            className="inline-flex h-4 min-w-[1.5rem] items-center justify-center rounded px-1 text-[9px] font-bold text-white"
            style={{
              backgroundColor: `color-mix(in oklab, ${POST_ACCENT} 70%, #0b1220)`,
              border: `1px solid color-mix(in oklab, ${POST_ACCENT} 55%, transparent)`,
            }}
          >
            200
          </span>
          <span className="mx-0.5 h-3 w-px bg-border" aria-hidden />
          <span className="flex h-5 w-5 items-center justify-center text-slate-500" aria-hidden>
            <Codicon name="eraser" className="text-xs" />
          </span>
          <span className="flex h-5 w-5 items-center justify-center text-slate-500" aria-hidden>
            <Codicon name="history" className="text-xs" />
          </span>
          <span className="flex h-5 w-5 items-center justify-center text-slate-500" aria-hidden>
            <Codicon name="split-horizontal" className="text-xs" />
          </span>
        </div>
      </div>

      <div className="min-h-[120px] flex-1 overflow-hidden">
        <JsonBlock lines={RESPONSE_BODY_LINES} />
      </div>
    </div>
  )
}

interface RunnerStep {
  label: string
  detail: string
  duration: string
}

const TEST_RUN_STEPS: RunnerStep[] = [
  { label: 'Send an echo request', detail: 'POST https://test.mmt.dev/echo', duration: '118ms' },
  { label: 'Expect status', detail: 'status == 200', duration: '1ms' },
  { label: 'Expect message', detail: 'body.body.message == hello', duration: '1ms' },
]

const SUITE_RUN_STEPS: RunnerStep[] = [
  { label: 'test/login.mmt', detail: 'Run login test', duration: '92ms' },
  { label: 'test/echo_test.mmt', detail: 'Run echo test', duration: '124ms' },
  { label: 'test/status_test.mmt', detail: 'Run status test', duration: '92ms' },
]

function OverviewBox({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: 'pass' | 'fail' | 'total' | 'time'
}) {
  const tones = {
    pass: 'text-emerald-400 bg-emerald-500/15',
    fail: 'text-rose-400 bg-rose-500/15',
    total: 'text-sky-400 bg-sky-500/15',
    time: 'text-slate-400 bg-slate-500/15',
  }[tone]
  const icons = {
    pass: 'check',
    fail: 'close',
    total: 'list-flat',
    time: 'clock',
  }[tone]
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-light/45 px-2 py-2 min-w-0">
      <span className={`flex h-7 w-7 items-center justify-center rounded-md shrink-0 ${tones}`}>
        <Codicon name={icons} className="text-sm" />
      </span>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-sm text-slate-100 font-semibold leading-tight">{value}</div>
        <div className="text-[9px] text-slate-500 truncate">{sub}</div>
      </div>
    </div>
  )
}

function RunnerPanel({ mode }: { mode: 'test' | 'suite' }) {
  const isSuite = mode === 'suite'
  const rows = isSuite ? SUITE_RUN_STEPS : TEST_RUN_STEPS
  const title = isSuite ? 'Simple Suite' : 'Simple HTTP test'
  const runTitle = isSuite ? 'Run suite' : 'Run test'

  return (
    <VSCodeSidePanel title={title} icon={isSuite ? 'layers' : 'beaker'}>
      {/* Matches mmtview `.run-action-bar` — circular Run + more, right-aligned */}
      <div className="flex items-center justify-end gap-2 px-3 pt-2 pb-2">
        <ActionControl mode="run" title={runTitle} />
      </div>

      <div className="px-3 pb-3 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Overview</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <OverviewBox label="Passed" value="3" sub="100%" tone="pass" />
          <OverviewBox label="Failed" value="0" sub="0%" tone="fail" />
          <OverviewBox label="Total" value="3" sub={isSuite ? '3 files' : '3 checks'} tone="total" />
          <OverviewBox label="Duration" value={isSuite ? '0.216s' : '0.120s'} sub="just now" tone="time" />
        </div>
      </div>

      <div className="flex-1 px-3 py-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Report</div>
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="rounded-lg border border-border bg-surface-light/45 px-3 py-2"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Codicon name="check" className="text-[11px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm text-slate-200 truncate">{row.label}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">{row.duration}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 truncate">{row.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </VSCodeSidePanel>
  )
}

export default function HeroIllustration() {
  const [activeTab, setActiveTab] = useState<DemoTabId>('api')
  const [copied, setCopied] = useState(false)
  const tab = DEMO_TABS.find((item) => item.id === activeTab) || DEMO_TABS[0]

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tab.yaml.join('\n'))
      setCopied(true)
      window.setTimeout(() => {
        setCopied(false)
      }, 1600)
    } catch {
      // ignore clipboard failures
    }
  }, [tab.yaml])

  const onTabClick = useCallback((next: DemoTabId) => {
    setActiveTab(next)
    setCopied(false)
  }, [])

  const editorTabs: VSCodeEditorTab[] = DEMO_TABS.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    active: item.id === activeTab,
  }))

  return (
    <VSCodeDemoFrame>
      <VSCodeEditorTabs tabs={editorTabs} onTabClick={(id) => onTabClick(id as DemoTabId)} />
      <div className="flex flex-col sm:flex-row flex-1 min-h-0">
        <YamlPanel tab={tab} copied={copied} onCopy={onCopy} />
        {activeTab === 'api' ? <ApiPanel /> : <RunnerPanel mode={activeTab} />}
      </div>
    </VSCodeDemoFrame>
  )
}
