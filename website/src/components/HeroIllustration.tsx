import { useCallback, useState } from 'react'
import Codicon from './Codicon'

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

const TESTER_TABS = ['In / Out', 'Body', 'Params', 'Headers', 'Cookies', 'Doc']
const ACTIVITY_ICONS = ['files', 'search', 'source-control', 'debug-alt', 'extensions'] as const

function VSCodeLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17.4 3.2 8.7 11 3.8 7.3 2 8.6l4.9 3.5L2 15.8l1.8 1.3 4.9-3.7 8.7 7.4L22 18.9V5.1l-4.6-1.9Z"
        fill="#38BDF8"
      />
      <path d="M17.4 7.1v9.8l-6.3-4.8 6.3-5Z" fill="#0EA5E9" />
      <path d="M17.4 3.2v17.6L22 18.9V5.1l-4.6-1.9Z" fill="#0284C7" />
    </svg>
  )
}

function ActivityBar() {
  return (
    <div className="hero-activity-bar pt-5 pb-3 gap-1 border-r border-border bg-surface-light/70">
      <div className="mb-4 flex h-9 w-9 items-center justify-center" title="VS Code">
        <VSCodeLogo />
      </div>
      {ACTIVITY_ICONS.map((name, index) => (
        <span
          key={name}
          className={`flex h-8 w-8 items-center justify-center ${
            index === 0
              ? 'text-slate-200 border-l-2 border-primary-light bg-white/5'
              : 'text-slate-500'
          }`}
          aria-hidden="true"
        >
          <Codicon name={name} className="text-base" />
        </span>
      ))}
    </div>
  )
}

function EditorTabBar({
  activeTab,
  onTabClick,
}: {
  activeTab: DemoTabId
  onTabClick: (tab: DemoTabId) => void
}) {
  return (
    <div className="flex items-stretch border-b border-border bg-surface-light/40 min-h-9">
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {DEMO_TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabClick(tab.id)}
              className={`group flex items-center gap-1.5 px-3 h-9 text-[11px] sm:text-xs shrink-0 border-r border-border ${
                active
                  ? 'bg-surface text-slate-200 border-t-2 border-t-primary-light'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface/60 border-t-2 border-t-transparent'
              }`}
            >
              <Codicon name={tab.icon} className="text-sm opacity-80" />
              <span>{tab.label}</span>
              <span
                className={`ml-1 text-[10px] leading-none ${
                  active ? 'text-slate-500' : 'text-slate-600 group-hover:text-slate-400'
                }`}
                aria-hidden="true"
              >
                ×
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

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

function YamlLine({ line, colonIdx }: { line: string; colonIdx: number }) {
  const indent = line.match(/^(\s*)/)?.[1] || ''
  const keyword = line.slice(indent.length, colonIdx)
  const rest = line.slice(colonIdx)
  const valueStart = rest.indexOf(' ')
  const colon = valueStart === -1 ? rest : rest.slice(0, 2)
  const value = valueStart === -1 ? '' : rest.slice(2)
  return (
    <span style={{ paddingLeft: `${(indent.length / 2) * 12}px` }}>
      <span className="text-primary-light">{keyword}</span>
      <span className="text-slate-500">{colon}</span>
      {value ? <span className="text-accent">{value}</span> : null}
    </span>
  )
}

function JsonBlock({ lines }: { lines: string[] }) {
  return (
    <div className="px-3 pb-2 font-mono text-[10px] sm:text-xs leading-5 text-left">
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

function SendControl() {
  return (
    <div className="relative h-11 shrink-0">
      <div className="absolute inset-x-0 top-1/2 border-t border-border" />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
        <div
          className="w-[30px] h-[30px] rounded-full bg-emerald-600 border border-emerald-400/40 flex items-center justify-center shadow-lg shadow-emerald-500/20"
          title="Send"
        >
          <Codicon name="send" className="text-white text-base ml-0.5" />
        </div>
      </div>
    </div>
  )
}

function ApiPanel() {
  return (
    <div className="flex-1 flex flex-col min-w-0 border-t sm:border-t-0 sm:border-l border-border text-left bg-surface">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 shrink-0">
          POST
        </span>
        <div className="flex-1 bg-surface-light rounded px-2 py-1 text-[10px] sm:text-xs text-slate-400 font-mono truncate">
          https://test.mmt.dev/echo
        </div>
      </div>

      <div className="flex items-center gap-0 px-2 border-b border-border overflow-x-auto">
        {TESTER_TABS.map((tab) => {
          const active = tab === 'Body'
          return (
            <div
              key={tab}
              className={`px-2.5 py-1.5 text-[10px] sm:text-[11px] font-medium shrink-0 ${
                active
                  ? 'text-slate-200 border-b border-slate-200'
                  : 'text-slate-500 opacity-60'
              }`}
            >
              {tab}
            </div>
          )
        })}
      </div>

      <div className="flex-1 min-h-0">
        <JsonBlock lines={REQUEST_BODY_LINES} />
      </div>

      <SendControl />

      <div className="shrink-0">
        <JsonBlock lines={RESPONSE_BODY_LINES} />
      </div>

      <div className="flex items-center justify-end gap-1.5 px-3 py-1.5 border-t border-border">
        <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-surface-light text-slate-300 border border-border">
          142ms
        </span>
        <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          200
        </span>
        <span className="flex h-6 w-6 items-center justify-center text-slate-500" aria-hidden="true">
          <Codicon name="history" className="text-sm" />
        </span>
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
  const runLabel = isSuite ? 'Run suite' : 'Run test'

  return (
    <div className="flex-1 flex flex-col min-w-0 border-t sm:border-t-0 sm:border-l border-border text-left bg-surface">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Codicon name={isSuite ? 'layers' : 'beaker'} className="text-slate-300" />
          <span className="text-xs sm:text-sm text-slate-200 truncate">{title}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] sm:text-xs font-medium bg-primary text-white shrink-0">
          <Codicon name="run" className="text-sm" />
          {runLabel}
        </div>
      </div>

      <div className="px-3 py-3 border-b border-border">
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
    </div>
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

  return (
    <div className="glow rounded-2xl overflow-clip border border-border bg-surface">
      <div className="flex min-h-[520px] sm:min-h-[620px]">
        <ActivityBar />
        <div className="flex min-w-0 flex-1 flex-col">
          <EditorTabBar activeTab={activeTab} onTabClick={onTabClick} />
          <div className="flex flex-col sm:flex-row flex-1 min-h-0">
            <YamlPanel tab={tab} copied={copied} onCopy={onCopy} />
            {activeTab === 'api' ? <ApiPanel /> : <RunnerPanel mode={activeTab} />}
          </div>
        </div>
      </div>
    </div>
  )
}
