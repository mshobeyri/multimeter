import { motion, useReducedMotion } from 'framer-motion'

/* ── Copilot prompt (right panel, typed char-by-char) ─────────────── */

const COPILOT_PROMPT =
  '@mmt generate a sample login api with username and password. url should be https://mmt.dev/reflect'

/* ── Generated YAML lines (left panel, appear line-by-line) ───────── */

const YAML_LINES: { indent: number; keyword: string; value: string }[] = [
  { indent: 0, keyword: 'type', value: 'api' },
  { indent: 0, keyword: 'url', value: 'https://mmt.dev/reflect' },
  { indent: 0, keyword: 'method', value: 'post' },
  { indent: 0, keyword: 'format', value: 'json' },
  { indent: 0, keyword: 'body', value: '' },
  { indent: 1, keyword: 'username', value: 'mehrdad' },
  { indent: 1, keyword: 'password', value: '123456' },
]

/* ── timing constants ─────────────────────────────────────────────── */

const CHAR_SPEED = 0.03          // seconds per character in the prompt
const TYPING_DURATION = COPILOT_PROMPT.length * CHAR_SPEED  // ≈3.3 s
const RESPONSE_PAUSE = 0.8       // pause before YAML starts appearing
const YAML_LINE_DELAY = 0.35     // seconds between each YAML line
const YAML_START = TYPING_DURATION + RESPONSE_PAUSE

/* ── tiny sub-components ──────────────────────────────────────────── */

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

function CopilotIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path
        d="M12 2C6.48 2 2 6 2 11c0 3.1 1.6 5.8 4 7.5V22l3.3-1.8c.9.2 1.8.3 2.7.3 5.52 0 10-4 10-9s-4.48-9-10-9z"
        fill="currentColor"
        className="text-purple-400"
      />
      <circle cx="8.5" cy="11" r="1.2" fill="#1e1e2e" />
      <circle cx="15.5" cy="11" r="1.2" fill="#1e1e2e" />
    </svg>
  )
}

/* ── Typing prompt panel (right) ──────────────────────────────────── */

function CopilotPanel({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <div className="flex-1 flex flex-col min-w-0 border-l border-border sm:border-l sm:border-t-0 border-t text-left">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <CopilotIcon />
        <span className="text-xs font-medium text-purple-400">Copilot Chat</span>
      </div>

      {/* Chat area */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-3 overflow-hidden">
        {/* User bubble */}
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[9px] text-white font-bold shrink-0 mt-0.5">
            U
          </div>
          <div className="bg-surface-light border border-border rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 font-mono leading-relaxed max-w-full">
            {reducedMotion ? (
              <span>{COPILOT_PROMPT}</span>
            ) : (
              <span>
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
                {/* blinking cursor */}
                <motion.span
                  className="inline-block w-[2px] h-[14px] bg-purple-400 ml-[1px] align-middle"
                  animate={{ opacity: [1, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    repeatType: 'reverse',
                  }}
                />
              </span>
            )}
          </div>
        </div>

        {/* Thinking indicator */}
        <motion.div
          className="flex items-center gap-2 ml-7"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { delay: TYPING_DURATION + 0.2, duration: 0.3 }}
        >
          <CopilotIcon />
          <div className="flex items-center gap-1 text-xs text-purple-400/70">
            <motion.span
              animate={reducedMotion ? {} : { opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: 2, delay: TYPING_DURATION + 0.3 }}
            >
              Generating API…
            </motion.span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ── Generated YAML panel (left) ──────────────────────────────────── */

function YamlResultPanel({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <div className="flex-1 p-4 sm:p-5 font-mono text-xs sm:text-sm leading-6 min-w-0 text-left">
      <div className="text-slate-500 text-[10px] sm:text-xs mb-3 uppercase tracking-wider font-sans flex items-center gap-2">
        <span>Generated API</span>
        <motion.span
          className="text-green-400"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { delay: YAML_START + YAML_LINES.length * YAML_LINE_DELAY + 0.3, duration: 0.4 }
          }
        >
          ✓
        </motion.span>
      </div>
      {YAML_LINES.map((line, i) => (
        <motion.div
          key={i}
          className="whitespace-nowrap overflow-hidden"
          style={{ paddingLeft: `${line.indent * 16}px` }}
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  delay: YAML_START + i * YAML_LINE_DELAY,
                  duration: 0.4,
                }
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

  return (
    <div className="relative" aria-hidden="true">
      {/* Purple glow behind the card */}
      <div className="absolute -inset-4 bg-purple-500/10 rounded-3xl blur-2xl" />

      {/* Editor mockup */}
      <div className="glow rounded-2xl overflow-hidden border border-border bg-surface relative">
        <TitleBar filename="login.mmt" />
        <div className="flex flex-col sm:flex-row min-h-[420px] sm:min-h-[480px]">
          <YamlResultPanel reducedMotion={reducedMotion} />
          <CopilotPanel reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent z-10 pointer-events-none rounded-2xl" />
    </div>
  )
}
