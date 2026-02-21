import { motion, useReducedMotion } from 'framer-motion'

const YAML_LINES = [
  { indent: 0, keyword: 'type', value: 'api' },
  { indent: 0, keyword: 'url', value: 'https://mmt.dev/reflect' },
  { indent: 0, keyword: 'method', value: 'post' },
  { indent: 0, keyword: 'format', value: 'json' },
  { indent: 0, keyword: 'body', value: '' },
  { indent: 1, keyword: 'username', value: 'mehrdad' },
  { indent: 1, keyword: 'password', value: '123456' },
]

const REQUEST_BODY_LINES = [
  '{',
  '    "username": "mehrdad",',
  '    "password": 123456',
  '}',
]

const RESPONSE_BODY_LINES = [
  '{',
  '    "username": "mehrdad",',
  '    "password": 123456',
  '}',
]

const TABS = ['Body', 'Params', 'Headers']

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
          api.mmt
        </div>
      </div>
    </div>
  )
}

function YamlPanel({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <div className="flex-1 p-4 sm:p-5 font-mono text-xs sm:text-sm leading-6 min-w-0 text-left">
      <div className="text-slate-500 text-[10px] sm:text-xs mb-3 uppercase tracking-wider font-sans">
        Request
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
                  delay: i * 0.4,
                  duration: 0.5,
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

function JsonBlock({ lines, baseDelay, reducedMotion }: { lines: string[]; baseDelay: number; reducedMotion: boolean | null }) {
  return (
    <div className="px-3 pb-1 font-mono text-[10px] sm:text-xs leading-5">
      {lines.map((line, i) => (
        <motion.div
          key={i}
          className="whitespace-nowrap overflow-hidden"
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

function MouseCursor({ reducedMotion }: { reducedMotion: boolean | null }) {
  const clickDelay = 4.2
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
              delay: clickDelay - 0.6,
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

function ApiPanel({ reducedMotion }: { reducedMotion: boolean | null }) {
  const baseDelay = 2.8
  const sendClickDelay = 4.2
  const responseDelay = sendClickDelay + 0.5
  return (
    <div className="flex-1 flex flex-col min-w-0 border-l border-border sm:border-l sm:border-t-0 border-t text-left sm:-ml-[100px]">
      {/* URL Bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 shrink-0">
          POST
        </span>
        <div className="flex-1 bg-surface-light rounded px-2 py-1 text-[10px] sm:text-xs text-slate-400 font-mono truncate">
          https://mmt.dev/reflect
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
        <MouseCursor reducedMotion={reducedMotion} />
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

export default function HeroIllustration() {
  const reducedMotion = useReducedMotion()

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
    <div className="relative" aria-hidden="true">
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p, i) => (
          <Particle key={i} {...p} />
        ))}
      </div>

      {/* Editor mockup */}
      <div className="glow rounded-2xl overflow-hidden border border-border bg-surface relative">
        <TitleBar />
        <div className="flex flex-col sm:flex-row min-h-[560px] sm:min-h-[640px]">
          <YamlPanel reducedMotion={reducedMotion} />
          <ApiPanel reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* Bottom gradient fade (matches original hero screenshot style) */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent z-10 pointer-events-none rounded-2xl" />
    </div>
  )
}
