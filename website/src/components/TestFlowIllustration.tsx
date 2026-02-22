import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/* ── Hook: trigger once when element scrolls into view ────────────── */

function useInView(threshold = 0.2) {
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
      { threshold }
    )
    observer.observe(el)
    return () => { observer.disconnect() }
  }, [threshold])

  return { ref, inView }
}

/* ── Step definitions for the test-flow tree ──────────────────────── */

type StepKind = 'call' | 'assert' | 'delay' | 'for' | 'if' | 'set' | 'check' | 'print' | 'repeat'

interface FlowStep {
  kind: StepKind
  label: string
  value: string
  children?: FlowStep[]
}

const FLOW_STEPS: FlowStep[] = [
  { kind: 'call',   label: 'call',   value: 'login' },
  { kind: 'assert', label: 'assert', value: 'login.status == 200' },
  { kind: 'delay',  label: 'delay',  value: '1s' },
  { kind: 'for',    label: 'for',    value: 'user of users', children: [
    { kind: 'call',  label: 'call',   value: 'getProfile' },
    { kind: 'check', label: 'check',  value: 'profile.name == user.name' },
    { kind: 'if',    label: 'if',     value: 'user.admin == true', children: [
      { kind: 'call', label: 'call',  value: 'getPermissions' },
    ]},
  ]},
  { kind: 'print',  label: 'print',  value: '"All done"' },
]

/* ── Timing ───────────────────────────────────────────────────────── */

const STEP_DELAY = 0.3

/* ── Flatten with depth ───────────────────────────────────────────── */

interface FlatStep {
  step: FlowStep
  depth: number
  index: number
  hasChildren: boolean
}

function flattenSteps(steps: FlowStep[], depth = 0): FlatStep[] {
  const out: FlatStep[] = []
  for (const s of steps) {
    out.push({ step: s, depth, index: 0, hasChildren: !!s.children?.length })
    if (s.children) {
      out.push(...flattenSteps(s.children, depth + 1))
    }
  }
  out.forEach((f, i) => (f.index = i))
  return out
}

const FLAT_STEPS = flattenSteps(FLOW_STEPS)
const TOTAL_APPEAR = FLAT_STEPS.length * STEP_DELAY

/* ── Swap animation constants ─────────────────────────────────────── */
const SWAP_A = 1
const SWAP_B = 2
const SWAP_INITIAL_DELAY = TOTAL_APPEAR + 1.5
const BOX_H = 46

/* ── CSS keyframes for the swap (injected once via <style>) ───────── */

const swapDownKeyframes = `
@keyframes swapDown {
  0%, 15% { transform: translateY(0); }
  35%, 65% { transform: translateY(${BOX_H}px); }
  85%, 100% { transform: translateY(0); }
}
`

const swapUpKeyframes = `
@keyframes swapUp {
  0%, 15% { transform: translateY(0); }
  35%, 65% { transform: translateY(${-BOX_H}px); }
  85%, 100% { transform: translateY(0); }
}
`

const cursorKeyframes = `
@keyframes cursorFade {
  0%, 10% { opacity: 0; }
  18%, 80% { opacity: 1; }
  90%, 100% { opacity: 0; }
}
`

/* ── Icon per step kind (white) ───────────────────────────────────── */

const kindIcon: Record<StepKind, string> = {
  call:   '⇢',
  assert: '✓',
  check:  '✓',
  delay:  '⏸',
  for:    '↻',
  repeat: '↻',
  if:     '◇',
  set:    '≡',
  print:  '▸',
}

/* ── Sub-components ───────────────────────────────────────────────── */

function TitleBar() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface/80">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
      </div>
      <div className="ml-3 flex items-center gap-1">
        <div className="px-3 py-1 rounded-t text-xs font-medium text-slate-300 bg-surface-light border border-border border-b-0">
          login-flow.mmt
        </div>
      </div>
    </div>
  )
}

function TabBar() {
  return (
    <div className="flex items-center gap-0 px-4 border-b border-border">
      {[
        { label: 'Overview', icon: '◎' },
        { label: 'Flow',    icon: '⊞' },
        { label: 'Code',    icon: '{ }' },
      ].map((tab, i) => (
        <div
          key={tab.label}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-medium cursor-default ${
            i === 1
              ? 'text-slate-200 border-b-2 border-accent'
              : 'text-slate-500'
          }`}
        >
          <span className="text-xs">{tab.icon}</span>
          {tab.label}
        </div>
      ))}
    </div>
  )
}

/* ── Individual flow-step box ─────────────────────────────────────── */

function FlowStepBox({
  flat,
  reducedMotion,
  swapDir,
  inView,
}: {
  flat: FlatStep
  reducedMotion: boolean | null
  swapDir?: 'down' | 'up'
  inView: boolean
}) {
  const { step, depth, index, hasChildren } = flat
  const appearDelay = index * STEP_DELAY
  const icon = kindIcon[step.kind]

  const isSwapped = !!swapDir
  const showCursor = swapDir === 'down'
  const animName = swapDir === 'down' ? 'swapDown' : swapDir === 'up' ? 'swapUp' : undefined
  const skip = !inView && !reducedMotion

  return (
    <motion.div
      style={{
        paddingLeft: `${16 + depth * 28}px`,
        paddingRight: 16,
        position: 'relative',
        ...(isSwapped && !reducedMotion && inView ? {
          animation: `${animName} 5s ease-in-out ${SWAP_INITIAL_DELAY}s infinite`,
        } : {}),
      }}
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -14 }}
      animate={skip ? { opacity: 0, x: -14 } : { opacity: 1, x: 0 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { delay: appearDelay, duration: 0.35, ease: 'easeOut' }
      }
    >
      <div className={`flex items-center gap-0 rounded border bg-surface-light/60 min-h-[40px] ${isSwapped ? 'border-border z-10 relative' : 'border-border'}`}>
        {/* Collapse caret / icon area */}
        <span className="flex items-center justify-center w-10 shrink-0 text-slate-300 text-sm">
          {hasChildren ? '▾' : (
            <span className="text-slate-300 text-sm">{icon}</span>
          )}
        </span>

        {/* Type label */}
        <span className="text-xs sm:text-sm text-slate-400 font-mono w-[56px] sm:w-[64px] shrink-0 py-2.5">
          {step.label}
        </span>

        {/* Value input mockup */}
        <div className="flex-1 min-w-0 px-2 py-1.5">
          <div className="bg-surface/60 rounded px-2.5 py-1.5 text-xs sm:text-sm text-slate-300 font-mono truncate border border-border/50">
            {step.value}
          </div>
        </div>

        {/* Action buttons (kebab + gripper) */}
        <div className="flex items-center gap-0.5 px-1.5 shrink-0">
          <span className="text-slate-600 text-xs px-1 cursor-default">⋮</span>
          <span className="text-slate-600 text-xs px-1 cursor-default">⠿</span>
        </div>
      </div>

      {/* Mouse cursor attached to the dragged item */}
      {showCursor && !reducedMotion && (
        <div
          className="absolute z-30 pointer-events-none"
          style={{
            right: 20,
            top: 10,
            animation: `cursorFade 5s ease-in-out ${SWAP_INITIAL_DELAY}s infinite`,
          }}
        >
          <svg width="18" height="22" viewBox="0 0 16 20" fill="none">
            <path
              d="M1 1L1 14L4.5 10.5L8 17L10.5 16L7 9.5L12 9.5L1 1Z"
              fill="white"
              stroke="#334155"
              strokeWidth="1"
            />
          </svg>
        </div>
      )}
    </motion.div>
  )
}

/* ── Main illustration ────────────────────────────────────────────── */

export default function TestFlowIllustration() {
  const reducedMotion = useReducedMotion()
  const { ref, inView } = useInView(0.15)

  return (
    <div className="relative" ref={ref} aria-hidden="true">
      {/* Inject CSS keyframes */}
      <style>{swapDownKeyframes}{swapUpKeyframes}{cursorKeyframes}</style>

      {/* Editor mockup */}
      <div className="glow rounded-2xl overflow-hidden border border-border bg-surface relative">
        <TitleBar />
        <TabBar />

        {/* Flow tree */}
        <div className="flex flex-col gap-[6px] py-3 px-0 min-h-[400px] sm:min-h-[460px] relative">
          {FLAT_STEPS.map((flat, i) => {
            let swapDir: 'down' | 'up' | undefined
            if (i === SWAP_A) {
              swapDir = 'down'
            } else if (i === SWAP_B) {
              swapDir = 'up'
            }
            return (
              <FlowStepBox
                key={i}
                flat={flat}
                reducedMotion={reducedMotion}
                swapDir={reducedMotion ? undefined : swapDir}
                inView={inView}
              />
            )
          })}
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent z-10 pointer-events-none rounded-2xl" />
    </div>
  )
}
