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

/** Compact response for the test report panel (keeps Request/Response in view). */
const TEST_RESPONSE_BODY_LINES = [
  '{',
  '  "method": "POST",',
  '  "path": "/echo",',
  '  "body": { "message": "hello" }',
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
      <div className="flex items-center gap-2 px-2">
        <div className="min-w-0 flex-1">
          <TabStrip tabs={REQUEST_TABS} />
        </div>
      </div>

      <div className="min-h-[72px] flex-1 overflow-hidden">
        <JsonBlock lines={REQUEST_BODY_LINES} />
      </div>

      {/* Response tabs + duration / status / tools (matches apitest-response-tabs-row) */}
      <div className="flex items-center gap-2 px-2 min-h-8">
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
  duration: string
}

const SUITE_RUN_STEPS: RunnerStep[] = [
  { label: 'test/login.mmt', duration: '92ms' },
  { label: 'test/echo_test.mmt', duration: '124ms' },
  { label: 'test/status_test.mmt', duration: '92ms' },
]

/** Passed expects inside the single echo step — matches the test YAML. */
const TEST_EXPECTS = ['status == 200', 'body.body.message == hello']

const OVERVIEW_TONES = {
  pass: { fg: '#3fb950', bg: 'rgba(63, 185, 80, 0.15)', icon: 'check' },
  fail: { fg: '#f85149', bg: 'rgba(248, 81, 73, 0.15)', icon: 'close' },
  total: { fg: '#58a6ff', bg: 'rgba(88, 166, 255, 0.15)', icon: 'list-flat' },
  time: { fg: '#8b949e', bg: 'rgba(139, 148, 158, 0.15)', icon: 'clock' },
} as const

function OverviewBox({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: keyof typeof OVERVIEW_TONES
}) {
  const theme = OVERVIEW_TONES[tone]
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-[10px] border border-white/10 bg-[#0b1220] px-3 py-2.5">
      <span
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
        style={{ backgroundColor: theme.bg, color: theme.fg }}
      >
        <Codicon name={theme.icon} className="text-base" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[9px] font-medium uppercase tracking-wide text-slate-400 opacity-60">{label}</span>
        <span className="text-lg font-bold leading-tight" style={{ color: theme.fg }}>{value}</span>
        <span className="truncate text-[9px]" style={{ color: theme.fg }}>{sub}</span>
      </div>
    </div>
  )
}

function ReportSectionTitle({ label, first }: { label: string; first?: boolean }) {
  return (
    <div className={first ? 'mt-0.5' : 'mt-2'}>
      <div className="text-[10px] font-semibold uppercase text-slate-300 opacity-70">{label}</div>
      <hr className="mt-0.5 mb-1 border-0 border-t border-[#444] opacity-50" />
    </div>
  )
}

function ReportBody({ lines }: { lines: string[] }) {
  return (
    <div className="rounded bg-[#0b1220] px-2.5 py-1 font-mono text-[10px] leading-4">
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

/** One expanded report step: Expects + Request/Response bodies. */
function TestReport() {
  return (
    <div className="rounded-md border border-[#2a2a2a] p-2.5">
      <div className="rounded-md border border-[#2a2a2a]">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <span className="inline-flex w-5 shrink-0 items-center justify-center text-slate-400" aria-hidden>
            <Codicon name="chevron-down" className="text-sm" />
          </span>
          <Codicon name="pass" className="shrink-0 text-xs text-[#23d18b]" title="Passed" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200">Send an echo request</span>
          <span className="shrink-0 text-[10px] text-slate-400 opacity-70">7:08:14 AM</span>
        </div>
        <div className="mb-1.5 mr-2.5 ml-[36px]">
          <ReportSectionTitle label="Expects" first />
          <div className="mt-0.5 flex flex-col gap-1.5">
            {TEST_EXPECTS.map((comparison) => (
              <div key={comparison} className="flex items-center gap-1.5 pl-0.5">
                <Codicon name="pass" className="shrink-0 text-[10px] text-[#23d18b]" title="Passed" />
                <span className="truncate font-mono text-[10px] text-slate-200">{comparison}</span>
              </div>
            ))}
          </div>

          <ReportSectionTitle label="Request" />
          <ReportBody lines={REQUEST_BODY_LINES} />

          <ReportSectionTitle label="Response" />
          <ReportBody lines={TEST_RESPONSE_BODY_LINES} />
        </div>
      </div>
    </div>
  )
}

function RunnerPanel({ mode }: { mode: 'test' | 'suite' }) {
  const isSuite = mode === 'suite'
  const title = isSuite ? 'Simple Suite' : 'Simple HTTP test'
  const runTitle = isSuite ? 'Run suite' : 'Run test'

  return (
    <VSCodeSidePanel title={title} icon={isSuite ? 'layers' : 'beaker'}>
      {/* Whole panel body scrolls so Request/Response are reachable */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Matches mmtview `.run-action-bar` — circular Run + more, right-aligned */}
        <div className="flex items-center justify-end gap-2 px-3 pt-2 pb-2">
          <ActionControl mode="run" title={runTitle} />
        </div>

        <div className="px-3 pb-3">
          <div className="mb-1.5 px-1 pt-1 text-[13px] font-bold text-[#939393]">Overview</div>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <OverviewBox label="Passed" value={isSuite ? '3' : '1'} sub="100.0%" tone="pass" />
            <OverviewBox label="Failed" value="0" sub="0.0%" tone="fail" />
            <OverviewBox label="Total" value={isSuite ? '3' : '1'} sub={isSuite ? '3 files' : '1 check'} tone="total" />
            <OverviewBox label="Duration" value={isSuite ? '308ms' : '118ms'} sub="just now" tone="time" />
          </div>
        </div>

        <div className="px-3 pb-3">
          <div className="mb-1.5 px-1 text-[13px] font-bold text-[#939393]">Report</div>
          {isSuite ? (
            <div className="space-y-2">
              {SUITE_RUN_STEPS.map((row) => (
                <div
                  key={row.label}
                  className="rounded-md border border-[#2a2a2a] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex w-6 shrink-0 items-center justify-center text-slate-400" aria-hidden>
                      <Codicon name="chevron-right" className="text-base" />
                    </span>
                    <Codicon name="pass" className="shrink-0 text-sm text-[#23d18b]" title="Passed" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-200">{row.label}</span>
                    <span className="shrink-0 text-xs text-slate-400 opacity-70">{row.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TestReport />
          )}
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
    <VSCodeDemoFrame minHeightClass="min-h-[560px] sm:min-h-[680px]">
      <VSCodeEditorTabs tabs={editorTabs} onTabClick={(id) => onTabClick(id as DemoTabId)} />
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <YamlPanel tab={tab} copied={copied} onCopy={onCopy} />
        {activeTab === 'api' ? <ApiPanel /> : <RunnerPanel mode={activeTab} />}
      </div>
    </VSCodeDemoFrame>
  )
}
