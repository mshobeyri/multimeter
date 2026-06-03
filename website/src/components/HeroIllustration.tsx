import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

type DemoTabId = 'api' | 'test' | 'suite'

interface DemoTab {
  id: DemoTabId
  label: string
  eyebrow: string
  yaml: string[]
}

const DEMO_TABS: DemoTab[] = [
  {
    id: 'api',
    label: 'api.mmt',
    eyebrow: 'API definition',
    yaml: [
      'type: api',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: json',
      'body:',
      '  name: Multimeter',
      '  message: Hello from mmt!',
    ],
  },
  {
    id: 'test',
    label: 'test.mmt',
    eyebrow: 'Simple test',
    yaml: [
      'type: test',
      'steps:',
      '  - http: https://test.mmt.dev/echo',
      '    title: Send an echo request',
      '    method: post',
      '    body:',
      '      message: hello world',
      '    expect:',
      '      status: 200',
      '      body.body.message: hello world',
    ],
  },
  {
    id: 'suite',
    label: 'suite.mmt',
    eyebrow: 'Simple suite',
    yaml: [
      'type: suite',
      'tests:',
      '  - test/login.mmt',
      '  - test/echo_test.mmt',
      '  - test/status_test.mmt',
    ],
  },
]

const TAB_ORDER: DemoTabId[] = ['api', 'test', 'suite']
const TYPE_START_DELAY_MS = 200
const TYPE_DELAY_MS = 18
const ACTION_AFTER_TYPING_DELAY_MS = 1000
const NEXT_TAB_PAUSE_MS = 2000

const REQUEST_BODY_LINES = [
  '{',
  '    "name": "Multimeter",',
  '    "message": "Hello from mmt!"',
  '}',
]

const RESPONSE_BODY_LINES = [
  '{',
  '    "body": {',
  '      "name": "Multimeter",',
  '      "message": "Hello from mmt!"',
  '    }',
  '}',
]

const TABS = ['Body', 'Params', 'Headers']

function getActionStartDelaySeconds(tab: DemoTab) {
  const typingMs = TYPE_START_DELAY_MS + tab.yaml.join('\n').length * TYPE_DELAY_MS
  return (typingMs + ACTION_AFTER_TYPING_DELAY_MS) / 1000
}

function useInView(threshold = 0.35) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) { return }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(el)
        }
      },
      { threshold, rootMargin: '-20% 0px 0px 0px' }
    )
    observer.observe(el)
    return () => { observer.disconnect() }
  }, [threshold])

  return { ref, inView }
}

function Particle({ delay, x, size }: { delay: number; x: number; size: number }) {
  const reducedMotion = useReducedMotion()
  if (reducedMotion) {
    return null
  }

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        bottom: '-4px',
        background: 'rgba(129, 140, 248, 0.3)',
      }}
      animate={{
        y: [0, -300, -500],
        opacity: [0, 0.6, 0],
      }}
      transition={{
        duration: 6,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  )
}

function VSCodeLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17.4 3.2 8.7 11 3.8 7.3 2 8.6l4.9 3.5L2 15.8l1.8 1.3 4.9-3.7 8.7 7.4L22 18.9V5.1l-4.6-1.9Z"
        fill="#38BDF8"
      />
      <path
        d="M17.4 7.1v9.8l-6.3-4.8 6.3-5Z"
        fill="#0EA5E9"
      />
      <path
        d="M17.4 3.2v17.6L22 18.9V5.1l-4.6-1.9Z"
        fill="#0284C7"
      />
    </svg>
  )
}

function TitleBar({
  activeTab,
  onTabClick,
}: {
  activeTab: DemoTabId
  onTabClick: (tab: DemoTabId) => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-border bg-surface/80">
      <div className="flex gap-1.5 shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
      </div>
      <div className="ml-1 sm:ml-3 flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-slate-400 shrink-0">
        <VSCodeLogo />
        VS Code
      </div>
      <div className="flex items-end gap-1 min-w-0 overflow-x-auto">
        {DEMO_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabClick(tab.id)}
            className={`px-2.5 sm:px-3 py-1 rounded-t text-[10px] sm:text-xs font-medium border border-b-0 transition-colors shrink-0 ${
              activeTab === tab.id
                ? 'text-slate-200 bg-surface-light border-border'
                : 'text-slate-500 bg-surface/40 border-transparent hover:text-slate-300 hover:bg-surface-light/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function YamlPanel({
  tab,
  inView,
  reducedMotion,
  animationKey,
}: {
  tab: DemoTab
  inView: boolean
  reducedMotion: boolean | null
  animationKey: number
}) {
  const fullText = tab.yaml.join('\n')
  const [charCount, setCharCount] = useState(reducedMotion ? fullText.length : 0)

  useEffect(() => {
    if (!inView || reducedMotion) { return }
    let interval: number | undefined
    const timer = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setCharCount((c) => {
          if (c >= fullText.length) {
            if (interval !== undefined) {
              window.clearInterval(interval)
            }
            return c
          }
          return c + 1
        })
      }, TYPE_DELAY_MS)
    }, TYPE_START_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      if (interval !== undefined) {
        window.clearInterval(interval)
      }
    }
  }, [animationKey, fullText.length, inView, reducedMotion])

  const visibleText = reducedMotion ? fullText : fullText.slice(0, charCount)
  const showCursor = !reducedMotion && charCount < fullText.length && inView

  const visibleLines = visibleText.split('\n')

  return (
    <div className="flex-1 p-4 sm:p-5 font-mono text-xs sm:text-sm leading-6 min-w-0 text-left">
      <div className="text-slate-500 text-[10px] sm:text-xs mb-3 uppercase tracking-wider font-sans">
        {tab.eyebrow}
      </div>
      {visibleLines.map((line, i) => {
        const colonIdx = line.indexOf(':')
        if (colonIdx === -1) {
          return <div key={i} className="whitespace-nowrap overflow-hidden"><span className="text-slate-300">{line}</span></div>
        }
        const indent = line.match(/^(\s*)/)?.[1] || ''
        const keyword = line.slice(indent.length, colonIdx)
        const rest = line.slice(colonIdx)
        const colonAndValue = rest.startsWith(': ') ? rest : rest
        const valueStart = colonAndValue.indexOf(' ')
        const colon = valueStart === -1 ? colonAndValue : colonAndValue.slice(0, 2)
        const value = valueStart === -1 ? '' : colonAndValue.slice(2)

        return (
          <div key={i} className="whitespace-nowrap overflow-hidden" style={{ paddingLeft: `${(indent.length / 2) * 16}px` }}>
            <span className="text-primary-light">{keyword}</span>
            <span className="text-slate-500">{colon}</span>
            {value && <span className="text-accent">{value}</span>}
            {i === visibleLines.length - 1 && showCursor && (
              <span className="inline-block w-[2px] h-[1.1em] bg-primary-light align-middle animate-pulse ml-[1px]" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function JsonBlock({ lines, baseDelay, reducedMotion }: { lines: string[]; baseDelay: number; reducedMotion: boolean | null }) {
  return (
    <div className="px-3 pb-1 font-mono text-[10px] sm:text-xs leading-5">
      {lines.map((line, i) => (
        <motion.div
          key={i}
          className="whitespace-pre overflow-hidden"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { delay: baseDelay + i * 0.12, duration: 0.3 }
          }
        >
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
        </motion.div>
      ))}
    </div>
  )
}

function MouseCursor({
  reducedMotion,
  startDelay,
}: {
  reducedMotion: boolean | null
  startDelay: number
}) {
  const clickDelay = startDelay + 0.6
  return (
    <motion.div
      className="absolute z-20 pointer-events-none"
      style={{ right: 6, top: -16 }}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 30, y: -20 }}
      animate={
        reducedMotion
          ? { opacity: 0 }
          : {
              opacity: [0, 1, 1, 1, 0],
              x: [30, 0, 0, 0, 0],
              y: [-20, 0, 0, 2, 0],
            }
      }
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              delay: startDelay,
              duration: 1.2,
              times: [0, 0.4, 0.5, 0.6, 1],
              ease: 'easeInOut',
            }
      }
    >
      {/* Cursor SVG */}
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
        <path
          d="M1 1L1 14L4.5 10.5L8 17L10.5 16L7 9.5L12 9.5L1 1Z"
          fill="white"
          stroke="#334155"
          strokeWidth="1"
        />
      </svg>
      {/* Click ripple */}
      <motion.div
        className="absolute -top-1 -left-1 w-4 h-4 rounded-full border border-white/40"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={reducedMotion ? {} : { opacity: [0, 0.6, 0], scale: [0.5, 1.5, 2] }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { delay: clickDelay, duration: 0.5, ease: 'easeOut' }
        }
      />
    </motion.div>
  )
}

function ApiPanel({
  reducedMotion,
  actionStartDelay,
}: {
  reducedMotion: boolean | null
  actionStartDelay: number
}) {
  const baseDelay = 2.8
  const sendClickDelay = actionStartDelay + 0.6
  const responseDelay = sendClickDelay + 0.5
  return (
    <div className="flex-1 flex flex-col min-w-0 border-l border-border sm:border-l sm:border-t-0 border-t text-left sm:-ml-[100px]">
      {/* URL Bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 shrink-0">
          POST
        </span>
        <div className="flex-1 bg-surface-light rounded px-2 py-1 text-[10px] sm:text-xs text-slate-400 font-mono truncate">
          https://test.mmt.dev/echo
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-0 px-3 border-b border-border">
        {TABS.map((tab, i) => (
          <div
            key={tab}
            className={`px-2.5 py-1.5 text-[9px] sm:text-[10px] font-medium cursor-default ${
              i === 0
                ? 'text-slate-200 border-b border-primary'
                : 'text-slate-500'
            }`}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Request Body Area */}
      <div className="flex-1 flex-col relative">
        <div className="px-3 py-1.5 text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider font-sans">
          Request Body
        </div>
        <JsonBlock lines={REQUEST_BODY_LINES} baseDelay={baseDelay + 0.3} reducedMotion={reducedMotion} />
      </div>

      {/* Divider + Send Button + Mouse Cursor */}
      <div className="relative border-t border-border -mt-[40px]">
        <div className="absolute right-3 -top-4 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center shadow-lg shadow-green-500/20 z-10 rotate-[40deg]">
          {/* Send/arrow icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>
        <MouseCursor reducedMotion={reducedMotion} startDelay={actionStartDelay} />
      </div>

      {/* Response Body Area */}
      <div className="flex-1 flex flex-col">
        <div className="px-3 py-1.5 text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wider font-sans">
          Response Body
        </div>
        <JsonBlock lines={RESPONSE_BODY_LINES} baseDelay={responseDelay + 0.15} reducedMotion={reducedMotion} />
      </div>

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-t border-border mt-auto">
        <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-accent/10 text-accent border border-accent/20">
          142ms
        </span>
        <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-green-500/15 text-green-400 border border-green-500/30">
          200
        </span>
      </div>
    </div>
  )
}

interface RunnerStep {
  label: string
  detail: string
  duration: string
  indent?: boolean
}

const TEST_RUN_STEPS: RunnerStep[] = [
  { label: 'Send an echo request', detail: 'POST https://test.mmt.dev/echo', duration: '118ms' },
  { label: 'Expect status', detail: 'status == 200', duration: '1ms' },
  { label: 'Expect message', detail: 'body.body.message == hello world', duration: '1ms' },
]

const SUITE_RUN_STEPS: RunnerStep[] = [
  { label: 'test/login.mmt', detail: 'Run login test', duration: '92ms', indent: true },
  { label: 'test/echo_test.mmt', detail: 'Run echo test', duration: '124ms', indent: true },
  { label: 'test/status_test.mmt', detail: 'Run status test', duration: '92ms', indent: true },
]

const RUN_CLICK_OFFSET = 1.15

const runPanelKeyframes = `
@keyframes heroRunProgress {
  0% { width: 0%; opacity: 0.7; }
  20% { opacity: 1; }
  100% { width: 100%; opacity: 1; }
}
@keyframes heroRunStatus {
  0%, 58% {
    background: rgba(234, 179, 8, 0.16);
    border-color: rgba(234, 179, 8, 0.35);
    color: rgb(250, 204, 21);
  }
  59%, 100% {
    background: rgba(34, 197, 94, 0.16);
    border-color: rgba(34, 197, 94, 0.35);
    color: rgb(74, 222, 128);
  }
}
@keyframes heroRunRow {
  0% { opacity: 0; transform: translateY(8px); }
  18%, 100% { opacity: 1; transform: translateY(0); }
}
@keyframes heroRunPing {
  75%, 100% { transform: scale(2); opacity: 0; }
}
@keyframes heroRunCursor {
  0% { opacity: 0; transform: translate(28px, -18px); }
  35% { opacity: 1; transform: translate(0, 0); }
  48% { opacity: 1; transform: translate(0, 0); }
  55% { opacity: 1; transform: translate(0, 2px); }
  68% { opacity: 1; transform: translate(0, 0); }
  100% { opacity: 0; transform: translate(0, 0); }
}
@keyframes heroRunClickRipple {
  0%, 48% { opacity: 0; transform: scale(0.45); }
  55% { opacity: 0.7; transform: scale(1); }
  100% { opacity: 0; transform: scale(2.1); }
}
@keyframes heroRunReadyText {
  0%, 52% { opacity: 1; transform: translateY(0); }
  65%, 100% { opacity: 0; transform: translateY(-4px); }
}
@keyframes heroRunActiveText {
  0%, 58% { opacity: 0; transform: translateY(4px); }
  70%, 100% { opacity: 1; transform: translateY(0); }
}
@keyframes heroRunStat {
  0%, 58% { opacity: 0.45; }
  70%, 100% { opacity: 1; }
}
@keyframes heroRunInitialStatValue {
  0%, 72% { opacity: 1; transform: translateY(0); }
  85%, 100% { opacity: 0; transform: translateY(-4px); }
}
@keyframes heroRunFinalStatValue {
  0%, 72% { opacity: 0; transform: translateY(4px); }
  85%, 100% { opacity: 1; transform: translateY(0); }
}
`

function AnimatedStatValue({
  initialValue,
  finalValue,
  doneDelay,
  reducedMotion,
}: {
  initialValue: string | number
  finalValue: string | number
  doneDelay: number
  reducedMotion: boolean | null
}) {
  if (reducedMotion) {
    return <>{finalValue}</>
  }

  return (
    <span className="relative inline-grid">
      <span
        className="col-start-1 row-start-1"
        style={{ animation: `heroRunInitialStatValue 1.1s ease-out ${doneDelay}s forwards` }}
      >
        {initialValue}
      </span>
      <span
        className="col-start-1 row-start-1 opacity-0"
        style={{ animation: `heroRunFinalStatValue 1.1s ease-out ${doneDelay}s forwards` }}
      >
        {finalValue}
      </span>
    </span>
  )
}

function RunButtonCursor({
  reducedMotion,
  startDelay,
}: {
  reducedMotion: boolean | null
  startDelay: number
}) {
  if (reducedMotion) {
    return null
  }

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        right: 8,
        top: 20,
        animation: `heroRunCursor 2.1s ease-in-out ${startDelay}s forwards`,
        opacity: 0,
      }}
    >
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
        <path
          d="M1 1L1 14L4.5 10.5L8 17L10.5 16L7 9.5L12 9.5L1 1Z"
          fill="white"
          stroke="#334155"
          strokeWidth="1"
        />
      </svg>
      <div
        className="absolute -top-1 -left-1 w-4 h-4 rounded-full border border-white/40"
        style={{ animation: `heroRunClickRipple 2.1s ease-out ${startDelay}s forwards` }}
      />
    </div>
  )
}

function RunnerPanel({
  mode,
  animationKey,
  reducedMotion,
  actionStartDelay,
}: {
  mode: 'test' | 'suite'
  animationKey: number
  reducedMotion: boolean | null
  actionStartDelay: number
}) {
  const isSuite = mode === 'suite'
  const rows = isSuite ? SUITE_RUN_STEPS : TEST_RUN_STEPS
  const title = isSuite ? 'Simple Suite' : 'Simple HTTP test'
  const runLabel = isSuite ? 'Run suite' : 'Run test'
  const runStartDelay = actionStartDelay + RUN_CLICK_OFFSET
  const runDoneDelay = runStartDelay + 4.2

  return (
    <div key={animationKey} className="flex-1 flex flex-col min-w-0 border-l border-border sm:border-l sm:border-t-0 border-t text-left sm:-ml-[100px]">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider">
            {isSuite ? 'Suite panel' : 'Test panel'}
          </div>
          <div className="text-xs sm:text-sm text-slate-200 truncate">{title}</div>
        </div>
        <div className="relative shrink-0">
          <div className="px-2.5 py-1.5 rounded bg-green-600 text-white text-[10px] sm:text-xs font-semibold shadow-lg shadow-green-500/20">
            {runLabel}
          </div>
          <RunButtonCursor reducedMotion={reducedMotion} startDelay={actionStartDelay} />
        </div>
      </div>

      <div className="px-3 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60"
                style={reducedMotion ? undefined : {
                  animation: `heroRunPing 1s cubic-bezier(0, 0, 0.2, 1) ${runStartDelay}s infinite`,
                  opacity: 0,
                }}
              />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
            </span>
            <span className="relative inline-grid min-w-[112px] text-xs sm:text-sm text-slate-300">
              <span
                className="col-start-1 row-start-1"
                style={reducedMotion ? { opacity: 0 } : { animation: `heroRunReadyText 2.4s ease-out ${actionStartDelay}s forwards` }}
              >
                Ready to run
              </span>
              <span
                className="col-start-1 row-start-1"
                style={reducedMotion ? { opacity: 1 } : { animation: `heroRunActiveText 2.4s ease-out ${actionStartDelay}s forwards`, opacity: 0 }}
              >
                Running checks...
              </span>
            </span>
          </div>
          <span className="text-[10px] sm:text-xs text-slate-500">{isSuite ? '2 files' : '3 checks'}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 py-3 border-b border-border">
        {[
          { label: 'Passed', initialValue: 0, finalValue: 3 },
          { label: 'Failed', initialValue: 0, finalValue: 0 },
          { label: 'Duration', initialValue: '0ms', finalValue: isSuite ? '216ms' : '120ms' },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded border border-border bg-surface-light/45 px-2 py-2"
            style={reducedMotion ? undefined : { animation: `heroRunStat 2.6s ease-out ${runStartDelay}s forwards`, opacity: 0.45 }}
          >
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</div>
            <div className="text-sm sm:text-base text-slate-100 font-semibold">
              <AnimatedStatValue
                initialValue={item.initialValue}
                finalValue={item.finalValue}
                doneDelay={runDoneDelay}
                reducedMotion={reducedMotion}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 px-3 py-3">
        <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider mb-2">
          Report
        </div>
        <div className="space-y-2">
          {rows.map((row, index) => {
            const delay = runStartDelay + 0.35 + index * 0.85
            return (
              <div
                key={row.label}
                className="rounded-lg border border-border bg-surface-light/45 px-3 py-2 opacity-0"
                style={reducedMotion ? { opacity: 1 } : { animation: `heroRunRow 0.45s ease-out ${delay}s forwards` }}
              >
                <div
                  className="flex items-start gap-2"
                  style={isSuite && row.indent ? { marginLeft: 16 } : undefined}
                >
                  <span
                    className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold"
                    style={reducedMotion ? {
                      background: 'rgba(34, 197, 94, 0.16)',
                      borderColor: 'rgba(34, 197, 94, 0.35)',
                      color: 'rgb(74, 222, 128)',
                    } : {
                      animation: `heroRunStatus 1.2s ease-out ${delay + 0.25}s forwards`,
                    }}
                  >
                    {index + 1}
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
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-t border-border mt-auto">
        <span
          className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-accent/10 text-accent border border-accent/20"
          style={reducedMotion ? undefined : { animation: `heroRunStat 2.6s ease-out ${runStartDelay}s forwards`, opacity: 0.45 }}
        >
          passed
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-green-500/15 text-green-400 border border-green-500/30"
          style={reducedMotion ? undefined : { animation: `heroRunStat 2.6s ease-out ${runStartDelay}s forwards`, opacity: 0.45 }}
        >
          0 failed
        </span>
      </div>
    </div>
  )
}

function DemoPanel({
  activeTab,
  animationKey,
  reducedMotion,
  actionStartDelay,
}: {
  activeTab: DemoTabId
  animationKey: number
  reducedMotion: boolean | null
  actionStartDelay: number
}) {
  if (activeTab === 'api') {
    return <ApiPanel key={animationKey} reducedMotion={reducedMotion} actionStartDelay={actionStartDelay} />
  }

  return (
    <RunnerPanel
      mode={activeTab}
      animationKey={animationKey}
      reducedMotion={reducedMotion}
      actionStartDelay={actionStartDelay}
    />
  )
}

export default function HeroIllustration() {
  const reducedMotion = useReducedMotion()
  const { ref, inView } = useInView()
  const [activeTab, setActiveTab] = useState<DemoTabId>('api')
  const [animationKey, setAnimationKey] = useState(0)
  const tab = DEMO_TABS.find((item) => item.id === activeTab) || DEMO_TABS[0]
  const actionStartDelay = getActionStartDelaySeconds(tab)

  useEffect(() => {
    if (!inView || reducedMotion) { return }
    const textMs = TYPE_START_DELAY_MS + tab.yaml.join('\n').length * TYPE_DELAY_MS
    const panelMs = activeTab === 'api'
      ? (actionStartDelay + 1.7) * 1000
      : (actionStartDelay + RUN_CLICK_OFFSET + 4.8) * 1000
    const timeout = window.setTimeout(() => {
      const currentIndex = TAB_ORDER.indexOf(activeTab)
      const nextTab = TAB_ORDER[(currentIndex + 1) % TAB_ORDER.length]
      setActiveTab(nextTab)
      setAnimationKey((key) => key + 1)
    }, Math.max(textMs, panelMs) + NEXT_TAB_PAUSE_MS)

    return () => { window.clearTimeout(timeout) }
  }, [activeTab, actionStartDelay, inView, reducedMotion, tab])

  const handleTabClick = (nextTab: DemoTabId) => {
    setActiveTab(nextTab)
    setAnimationKey((key) => key + 1)
  }

  const particles = [
    { delay: 0, x: 15, size: 3 },
    { delay: 1.5, x: 30, size: 2 },
    { delay: 3, x: 50, size: 4 },
    { delay: 0.8, x: 70, size: 2 },
    { delay: 2.5, x: 85, size: 3 },
    { delay: 4, x: 40, size: 2 },
    { delay: 1, x: 60, size: 3 },
    { delay: 3.5, x: 20, size: 2 },
  ]

  return (
    <div className="relative" ref={ref}>
      <style>{runPanelKeyframes}</style>
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p, i) => (
          <Particle key={i} {...p} />
        ))}
      </div>

      {/* Editor mockup */}
      <div className="glow rounded-2xl overflow-hidden border border-border bg-surface relative">
        <TitleBar activeTab={activeTab} onTabClick={handleTabClick} />
        <div className="flex flex-col sm:flex-row min-h-[560px] sm:min-h-[640px]">
          <YamlPanel
            key={`${activeTab}-${animationKey}`}
            tab={tab}
            inView={inView}
            reducedMotion={reducedMotion}
            animationKey={animationKey}
          />
          <DemoPanel
            activeTab={activeTab}
            animationKey={animationKey}
            reducedMotion={reducedMotion}
            actionStartDelay={actionStartDelay}
          />
        </div>
      </div>

      {/* Bottom gradient fade (matches original hero screenshot style) */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent z-10 pointer-events-none rounded-2xl" />
    </div>
  )
}
