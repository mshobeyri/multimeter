import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/* ── Content constants ────────────────────────────────────────────── */

const COPILOT_PROMPT =
  '@mmt generate a sample login api with username and password. url should be https://mmt.dev/reflect'

const YAML_LINES: { indent: number; keyword: string; value: string }[] = [
  { indent: 0, keyword: 'type', value: 'api' },
  { indent: 0, keyword: 'url', value: 'https://mmt.dev/reflect' },
  { indent: 0, keyword: 'method', value: 'post' },
  { indent: 0, keyword: 'format', value: 'json' },
  { indent: 0, keyword: 'body', value: '' },
  { indent: 1, keyword: 'username', value: 'mehrdad' },
  { indent: 1, keyword: 'password', value: '123456' },
]

/* ── Timing constants ─────────────────────────────────────────────── */

const CHAR_SPEED = 0.03
const TYPING_DURATION = COPILOT_PROMPT.length * CHAR_SPEED
const SEND_PAUSE = 0.5
const BUBBLE_APPEAR = TYPING_DURATION + SEND_PAUSE
const THINKING_APPEAR = BUBBLE_APPEAR + 0.4
const YAML_START = THINKING_APPEAR + 1.8
const YAML_LINE_DELAY = 0.35

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

/* ── Sub-components ───────────────────────────────────────────────── */

function TitleBar({ filename }: { filename: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface/80">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
      </div>
      <div className="ml-3 flex items-center gap-1">
        <div className="px-3 py-1 rounded-t text-xs font-medium text-slate-300 bg-surface-light border border-border border-b-0">
          {filename}
        </div>
      </div>
    </div>
  )
}

/** GitHub Copilot sparkle icon */
function CopilotIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className="shrink-0">
      <path
        d="M14 0C6.27 0 0 6.27 0 14s6.27 14 14 14 14-6.27 14-14S21.73 0 14 0zm6.59 17.15c-.37 1.27-1.7 2.35-3.2 2.65-.5.1-.85-.3-.7-.78.13-.4.52-.66.94-.78 1.04-.29 1.78-.93 1.98-1.63.3-1.02-.4-2.06-1.86-2.8l-.3-.14c-1.8-.83-2.93-1.99-2.93-3.67 0-.62.17-1.2.47-1.71.08-.14-.02-.32-.18-.3-2.77.5-4.74 2.37-4.74 4.82 0 .99.3 1.9.8 2.67.12.2-.04.45-.27.38-1.02-.32-1.87-.98-2.35-1.88-.1-.19-.4-.17-.44.05-.04.22-.06.44-.06.67 0 1.7.94 3.18 2.34 3.97.2.1.18.4-.04.44-.46.07-.94.07-1.4-.01-.2-.04-.36.17-.24.34.84 1.22 2.27 2.04 3.88 2.12.14.01.22.17.13.28-1.28 1.3-3.1 2.05-5.07 2.05-.35 0-.69-.02-1.03-.06-.18-.02-.3.2-.14.33A13.93 13.93 0 0 0 14 25.5c7.18 0 11.5-5.98 11.5-11.18 0-.17 0-.34-.01-.51a8.26 8.26 0 0 0 2.01-2.1c.14-.2-.06-.46-.28-.37-.75.3-1.55.5-2.39.58a4.15 4.15 0 0 0 1.83-2.29c.08-.22-.17-.41-.37-.28-.87.54-1.82.93-2.84 1.14A4.13 4.13 0 0 0 20.6 9.2c-2.28 0-4.13 1.85-4.13 4.13 0 .32.04.64.11.94-3.44-.17-6.49-1.82-8.53-4.32-.12-.14-.35-.12-.42.06a4.14 4.14 0 0 0 1.28 4.82"
        fill="currentColor"
        className="text-purple-400"
      />
    </svg>
  )
}

/* ── Input box at the bottom with typing animation ────────────────── */

function ChatInputBox({ reducedMotion, inView }: { reducedMotion: boolean | null; inView: boolean }) {
  if (!inView && !reducedMotion) {
    return (
      <div className="border-t border-border px-4 py-3 bg-surface/80">
        <div className="bg-surface-light border border-border rounded-xl px-4 py-3 flex items-start gap-3 min-h-[44px]">
          <CopilotIcon size={18} />
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-border px-4 py-3 bg-surface/80">
      <div className="bg-surface-light border border-border rounded-xl px-4 py-3 flex items-start gap-3">
        <CopilotIcon size={18} />
        <div className="flex-1 font-mono text-xs sm:text-sm text-slate-300 leading-relaxed min-h-[20px]">
          {reducedMotion ? (
            <span>{COPILOT_PROMPT}</span>
          ) : (
            <motion.span
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ delay: BUBBLE_APPEAR - 0.1, duration: 0.2 }}
            >
              {COPILOT_PROMPT.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * CHAR_SPEED, duration: 0.01 }}
                >
                  {char}
                </motion.span>
              ))}
              <motion.span
                className="inline-block w-[2px] h-[14px] bg-purple-400 ml-[1px] align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
              />
            </motion.span>
          )}
        </div>
        <motion.button
          className="mt-0.5 text-purple-400"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reducedMotion ? { duration: 0 } : { delay: TYPING_DURATION - 0.2, duration: 0.3 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}

/* ── Response message bubble (copilot side) ───────────────────────── */

function ResponseBubble({ reducedMotion, inView }: { reducedMotion: boolean | null; inView: boolean }) {
  const skip = !inView && !reducedMotion
  return (
    <div className="flex-1 flex flex-col min-w-0 border-l border-border sm:border-l sm:border-t-0 border-t text-left">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <CopilotIcon />
        <span className="text-xs font-medium text-purple-400">Copilot Chat</span>
      </div>

      {/* Chat area */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-3 overflow-hidden">
        {/* User message bubble — appears after typing */}
        <motion.div
          className="flex items-start gap-2"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={skip ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { delay: BUBBLE_APPEAR, duration: 0.35 }}
        >
          <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[9px] text-white font-bold shrink-0 mt-0.5">
            U
          </div>
          <div className="bg-surface-light border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 font-mono leading-relaxed max-w-full">
            {COPILOT_PROMPT}
          </div>
        </motion.div>

        {/* Thinking indicator */}
        <motion.div
          className="flex items-center gap-2 ml-7"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={skip ? { opacity: 0 } : { opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { delay: THINKING_APPEAR, duration: 0.3 }}
        >
          <CopilotIcon />
          <div className="flex items-center gap-1 text-xs text-purple-400/70">
            <motion.span
              animate={reducedMotion || skip ? {} : { opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: 2, delay: THINKING_APPEAR + 0.1 }}
            >
              Generating API…
            </motion.span>
          </div>
        </motion.div>
      </div>

      {/* Chat input — inside the right column */}
      <ChatInputBox reducedMotion={reducedMotion} inView={inView} />
    </div>
  )
}

/* ── Generated YAML panel (left) ──────────────────────────────────── */

function YamlResultPanel({ reducedMotion, inView }: { reducedMotion: boolean | null; inView: boolean }) {
  const skip = !inView && !reducedMotion
  return (
    <div className="flex-1 p-4 sm:p-5 font-mono text-xs sm:text-sm leading-6 min-w-0 text-left">
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={skip ? { opacity: 0 } : { opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { delay: YAML_START, duration: 0.3 }}
      >
        <div className="text-slate-500 text-[10px] sm:text-xs mb-3 uppercase tracking-wider font-sans flex items-center gap-2">
          <span>Generated API</span>
          <motion.span
            className="text-green-400"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={skip ? { opacity: 0 } : { opacity: 1 }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { delay: YAML_START + YAML_LINES.length * YAML_LINE_DELAY + 0.3, duration: 0.4 }
            }
          >
            ✓
          </motion.span>
        </div>
      </motion.div>
      {YAML_LINES.map((line, i) => (
        <motion.div
          key={i}
          className="whitespace-nowrap overflow-hidden"
          style={{ paddingLeft: `${line.indent * 16}px` }}
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
          animate={skip ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { delay: YAML_START + i * YAML_LINE_DELAY, duration: 0.4 }
          }
        >
          <span className="text-primary-light">{line.keyword}</span>
          <span className="text-slate-500">: </span>
          {line.value && <span className="text-accent">{line.value}</span>}
        </motion.div>
      ))}
    </div>
  )
}

/* ── Main illustration ────────────────────────────────────────────── */

export default function AIIllustration() {
  const reducedMotion = useReducedMotion()
  const { ref, inView } = useInView(0.15)

  return (
    <div className="relative" ref={ref} aria-hidden="true">
      {/* Purple glow behind the card */}
      <div className="absolute -inset-4 bg-purple-500/10 rounded-3xl blur-2xl" />

      {/* Editor mockup */}
      <div className="glow rounded-2xl overflow-hidden border border-border bg-surface relative">
        <TitleBar filename="login.mmt" />
        <div className="flex flex-col sm:flex-row min-h-[380px] sm:min-h-[420px]">
          <YamlResultPanel reducedMotion={reducedMotion} inView={inView} />
          <ResponseBubble reducedMotion={reducedMotion} inView={inView} />
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent z-10 pointer-events-none rounded-2xl" />
    </div>
  )
}
