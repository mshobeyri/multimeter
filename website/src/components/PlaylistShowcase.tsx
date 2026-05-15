import { useRef, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import FadeIn from '../components/FadeIn'

interface PlaylistVideo {
  id: string
  title: string
  description: string
}

interface PlaylistData {
  id: string
  title: string
  description: string
  videos: PlaylistVideo[]
}

interface GroupMeta {
  label: string
  title: string
  description: string
}

interface GroupedVideo {
  video: PlaylistVideo
  meta: ReturnType<typeof titleMeta>
}

const prefixKeywords = [
  'API',
  'Environment',
  'Mock Server',
  'Load Test',
  'Documentation',
  'WebSocket',
  'GraphQL',
  'gRPC',
  'Tutorial',
  'Flow',
  'Suite',
  'Report',
]

const groupDescriptions: Record<string, GroupMeta> = {
  api: {
    label: 'API',
    title: 'API Files',
    description: 'API files define reusable HTTP, WebSocket, GraphQL, or gRPC requests in Multimeter, including inputs, outputs, examples, and protocol-specific details.',
  },
  test: {
    label: 'TEST',
    title: 'Test Flows',
    description: 'Test files connect API calls into executable flows with assertions, checks, conditions, loops, and reusable steps that stay readable in Git.',
  },
  environment: {
    label: 'ENV VAR',
    title: 'Environment Variables',
    description: 'Environment files keep variables and presets together so the same APIs and tests can run cleanly across local, staging, and production setups.',
  },
  documentation: {
    label: 'DOCUMENT',
    title: 'Documentation Files',
    description: 'Documentation files turn your Multimeter APIs into shareable HTML or Markdown references generated from the same source files you already maintain.',
  },
  suite: {
    label: 'SUITE',
    title: 'Suite Files',
    description: 'Suite files bundle tests, servers, environment settings, and exports so larger scenarios can run as a coordinated workflow.',
  },
  'mock server': {
    label: 'MOCK SERVER',
    title: 'Mock Server Files',
    description: 'Mock server files describe HTTP and WebSocket endpoints directly in Multimeter so frontend and integration work can start before real services are ready.',
  },
  'load test': {
    label: 'LOAD TEST',
    title: 'Load Test Files',
    description: 'Load test files wrap a normal Multimeter test with concurrency, repeat, and ramp-up settings to measure performance without a separate toolchain.',
  },
  websocket: {
    label: 'WEBSOCKET',
    title: 'WebSocket Workflows',
    description: 'WebSocket workflows show how Multimeter handles connection-based APIs with the same YAML-first approach used for the rest of the platform.',
  },
  graphql: {
    label: 'GRAPHQL',
    title: 'GraphQL Workflows',
    description: 'GraphQL examples show how queries, mutations, variables, and assertions fit into Multimeter without switching to a separate editor or runtime.',
  },
  grpc: {
    label: 'GRPC',
    title: 'gRPC Workflows',
    description: 'gRPC examples cover service calls and protocol-specific setup while still using the same Multimeter file model and execution flow.',
  },
  flow: {
    label: 'FLOW',
    title: 'Flow Design',
    description: 'Flow-focused videos show how Multimeter represents branching, stages, and reusable execution paths as structured test logic instead of opaque scripts.',
  },
  report: {
    label: 'REPORT',
    title: 'Report Outputs',
    description: 'Report outputs let Multimeter runs produce CI-friendly, shareable, or interactive artifacts without maintaining separate reporting definitions.',
  },
  tutorial: {
    label: 'TUTORIAL',
    title: 'General Tutorials',
    description: 'General tutorials cover cross-cutting Multimeter workflows that span multiple file types and day-to-day usage patterns.',
  },
  video: {
    label: 'VIDEO',
    title: 'More Videos',
    description: 'Additional walkthroughs covering Multimeter features and practical workflows.',
  },
}

const groupOrder = [
  'api',
  'test',
  'documentation',
  'environment',
  'suite',
  'mock server',
  'load test',
  'websocket',
  'graphql',
  'grpc',
  'flow',
  'report',
  'tutorial',
  'video',
]

const groupFrameStyles: Record<string, string> = {
  api: 'border-sky-400/35 bg-[linear-gradient(180deg,rgba(14,165,233,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(14,165,233,0.08)]',
  test: 'border-emerald-400/35 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(16,185,129,0.08)]',
  environment: 'border-amber-400/35 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(245,158,11,0.08)]',
  suite: 'border-fuchsia-400/35 bg-[linear-gradient(180deg,rgba(217,70,239,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(217,70,239,0.08)]',
  documentation: 'border-violet-400/35 bg-[linear-gradient(180deg,rgba(167,139,250,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(167,139,250,0.08)]',
  'mock server': 'border-rose-400/35 bg-[linear-gradient(180deg,rgba(251,113,133,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(251,113,133,0.08)]',
  'load test': 'border-red-400/35 bg-[linear-gradient(180deg,rgba(248,113,113,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(248,113,113,0.08)]',
  websocket: 'border-cyan-400/35 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(34,211,238,0.08)]',
  graphql: 'border-indigo-400/35 bg-[linear-gradient(180deg,rgba(129,140,248,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(129,140,248,0.08)]',
  grpc: 'border-blue-400/35 bg-[linear-gradient(180deg,rgba(96,165,250,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(96,165,250,0.08)]',
  flow: 'border-teal-400/35 bg-[linear-gradient(180deg,rgba(45,212,191,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(45,212,191,0.08)]',
  report: 'border-orange-400/35 bg-[linear-gradient(180deg,rgba(251,146,60,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(251,146,60,0.08)]',
  tutorial: 'border-lime-400/35 bg-[linear-gradient(180deg,rgba(163,230,53,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(163,230,53,0.08)]',
  video: 'border-slate-300/25 bg-[linear-gradient(180deg,rgba(148,163,184,0.08),rgba(15,23,42,0.82))] shadow-[0_16px_60px_rgba(148,163,184,0.06)]',
}

const groupCardStyles: Record<string, string> = {
  api: 'border-sky-400/35 hover:border-sky-400/55',
  test: 'border-emerald-400/35 hover:border-emerald-400/55',
  environment: 'border-amber-400/35 hover:border-amber-400/55',
  suite: 'border-fuchsia-400/35 hover:border-fuchsia-400/55',
  documentation: 'border-violet-400/35 hover:border-violet-400/55',
  'mock server': 'border-rose-400/35 hover:border-rose-400/55',
  'load test': 'border-red-400/35 hover:border-red-400/55',
  websocket: 'border-cyan-400/35 hover:border-cyan-400/55',
  graphql: 'border-indigo-400/35 hover:border-indigo-400/55',
  grpc: 'border-blue-400/35 hover:border-blue-400/55',
  flow: 'border-teal-400/35 hover:border-teal-400/55',
  report: 'border-orange-400/35 hover:border-orange-400/55',
  tutorial: 'border-lime-400/35 hover:border-lime-400/55',
  video: 'border-slate-300/25 hover:border-slate-300/40',
}

function normalizeSpacing(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function titleMeta(title: string): { prefix: string; title: string } {
  const withoutBrand = normalizeSpacing(title.replace(/^multimeter\s+/i, ''))
  const splitMatch = withoutBrand.match(/^([^:-]{2,40})\s*[-:]\s*(.+)$/)

  if (splitMatch) {
    return {
      prefix: normalizeSpacing(splitMatch[1]),
      title: normalizeSpacing(splitMatch[2]),
    }
  }

  for (const keyword of prefixKeywords) {
    const keywordPattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i')
    if (keywordPattern.test(withoutBrand)) {
      const cleanedTitle = normalizeSpacing(withoutBrand.replace(keywordPattern, ''))
      return {
        prefix: keyword,
        title: cleanedTitle.length > 0 ? cleanedTitle : withoutBrand,
      }
    }
  }

  const words = withoutBrand.split(' ')
  if (words.length > 1) {
    return {
      prefix: words[0],
      title: normalizeSpacing(words.slice(1).join(' ')),
    }
  }

  return {
    prefix: 'Video',
    title: withoutBrand,
  }
}

function normalizeGroupKey(prefix: string): string {
  const normalized = prefix.trim().toLowerCase()

  if (
    normalized === 'env' ||
    normalized.includes('preset') ||
    normalized.includes('variable') ||
    normalized.includes('env var') ||
    normalized.includes('environment')
  ) {
    return 'environment'
  }

  if (
    normalized === 'document' ||
    normalized === 'doc' ||
    normalized === 'docs' ||
    normalized.includes('documentation')
  ) {
    return 'documentation'
  }

  if (normalized.includes('api')) {
    return 'api'
  }

  if (normalized.includes('test')) {
    return 'test'
  }

  return normalized
}

function getGroupMeta(prefix: string): GroupMeta {
  const key = normalizeGroupKey(prefix)
  return groupDescriptions[key] || {
    label: prefix.toUpperCase(),
    title: `${prefix} Videos`,
    description: 'Videos for this area of Multimeter.',
  }
}

function getGroupFrameStyle(groupKey: string): string {
  return groupFrameStyles[groupKey] || groupFrameStyles.video
}

function getGroupCardStyle(groupKey: string): string {
  return groupCardStyles[groupKey] || groupCardStyles.video
}

function groupVideos(videos: PlaylistVideo[]): Array<{ key: string; meta: GroupMeta; videos: GroupedVideo[] }> {
  const grouped = new Map<string, { key: string; meta: GroupMeta; videos: GroupedVideo[] }>()

  for (const video of videos) {
    const meta = titleMeta(video.title)
    const key = normalizeGroupKey(meta.prefix)
    const existing = grouped.get(key)

    if (existing) {
      existing.videos.push({ video, meta })
      continue
    }

    grouped.set(key, {
      key,
      meta: getGroupMeta(meta.prefix),
      videos: [{ video, meta }],
    })
  }

  return [...grouped.values()].sort((left, right) => {
    const leftIndex = groupOrder.indexOf(left.key)
    const rightIndex = groupOrder.indexOf(right.key)
    const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex
    const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex

    if (safeLeft !== safeRight) {
      return safeLeft - safeRight
    }

    return left.meta.title.localeCompare(right.meta.title)
  })
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const tokenPattern = /(\[[^\]]+\]\((https?:\/\/[^\s)]+)\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/\S+)/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
      if (linkMatch) {
        nodes.push(
          <a
            key={`${keyPrefix}-${match.index}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 underline decoration-sky-400/40 underline-offset-4 hover:text-sky-200"
          >
            {linkMatch[1]}
          </a>,
        )
      }
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${keyPrefix}-${match.index}`}
          className="rounded bg-white/8 px-1.5 py-0.5 text-[0.92em] text-sky-100"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-${match.index}`} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={`${keyPrefix}-${match.index}`} className="italic text-slate-200">
          {token.slice(1, -1)}
        </em>,
      )
    } else {
      nodes.push(
        <a
          key={`${keyPrefix}-${match.index}`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-300 underline decoration-sky-400/40 underline-offset-4 hover:text-sky-200 break-all"
        >
          {token}
        </a>,
      )
    }

    lastIndex = tokenPattern.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function renderMarkdown(description: string): ReactNode[] {
  const normalizedDescription = description
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
  const lines = normalizedDescription.split('\n')
  const blocks: ReactNode[] = []
  let paragraphLines: string[] = []
  let listItems: Array<{ kind: 'ul' | 'ol'; text: string }> = []
  let codeFence: { lines: string[] } | null = null

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return
    }

    const text = normalizeSpacing(paragraphLines.join(' '))
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-base leading-relaxed text-slate-300">
        {renderInlineMarkdown(text, `p-${blocks.length}`)}
      </p>,
    )
    paragraphLines = []
  }

  const flushList = () => {
    if (listItems.length === 0) {
      return
    }

    const kind = listItems[0].kind
    const ListTag = kind === 'ol' ? 'ol' : 'ul'
    blocks.push(
      <ListTag
        key={`list-${blocks.length}`}
        className={kind === 'ol' ? 'ml-5 list-decimal space-y-2 text-slate-300' : 'ml-5 list-disc space-y-2 text-slate-300'}
      >
        {listItems.map((item, index) => (
          <li key={`item-${index}`}>{renderInlineMarkdown(item.text, `list-${blocks.length}-${index}`)}</li>
        ))}
      </ListTag>,
    )
    listItems = []
  }

  const flushCodeFence = () => {
    if (!codeFence) {
      return
    }

    blocks.push(
      <pre
        key={`code-${blocks.length}`}
        className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-[13px] leading-6 text-sky-100"
      >
        <code>{codeFence.lines.join('\n')}</code>
      </pre>,
    )
    codeFence = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (codeFence) {
      if (line.startsWith('```')) {
        flushCodeFence()
      } else {
        codeFence.lines.push(rawLine)
      }
      continue
    }

    if (line.match(/^```\s*([^\s`]*)\s*$/)) {
      flushParagraph()
      flushList()
      codeFence = { lines: [] }
      continue
    }

    if (line.length === 0) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      blocks.push(
        <h4 key={`h-${blocks.length}`} className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">
          {renderInlineMarkdown(headingMatch[2], `h-${blocks.length}`)}
        </h4>,
      )
      continue
    }

    const unorderedMatch = line.match(/^[-*+]\s+(.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      listItems.push({ kind: 'ul', text: unorderedMatch[1] })
      continue
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      listItems.push({ kind: 'ol', text: orderedMatch[1] })
      continue
    }

    flushList()
    paragraphLines.push(rawLine)
  }

  flushParagraph()
  flushList()
  flushCodeFence()

  if (blocks.length > 0) {
    return blocks
  }

  return [
    <p key="fallback" className="text-base leading-relaxed text-slate-300">
      Watch this Multimeter walkthrough to see the workflow in action.
    </p>,
  ]
}

interface PlaylistShowcaseProps {
  playlist: PlaylistData
  reverseVideos?: boolean
  useRawTitles?: boolean
}

export default function PlaylistShowcase({
  playlist,
  reverseVideos = false,
  useRawTitles = false,
}: PlaylistShowcaseProps) {
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const videos = reverseVideos ? [...playlist.videos].reverse() : playlist.videos
  const groupedVideos = groupVideos(videos)

  const scrollRowRight = (groupKey: string) => {
    const row = rowRefs.current[groupKey]
    if (!row) {
      return
    }

    row.scrollBy({
      left: Math.max(row.clientWidth * 0.85, 320),
      behavior: 'smooth',
    })
  }

  return (
    <div className="space-y-8">
      {groupedVideos.map((group, groupIndex) => (
        <section
          key={group.key}
          className={`space-y-6 rounded-[34px] border px-5 py-6 sm:px-6 sm:py-7 ${getGroupFrameStyle(group.key)}`}
        >
          <FadeIn delay={groupIndex * 60}>
            <div className="px-2 sm:px-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-300/90">
                {group.meta.label}
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white sm:text-[2rem]">{group.meta.title}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300 sm:text-[0.98rem]">
                {group.meta.description}
              </p>
            </div>
          </FadeIn>

          <div className="relative px-1 sm:px-2">
            <div
              ref={(element) => {
                rowRefs.current[group.key] = element
              }}
              className="-mx-2 flex snap-x snap-mandatory gap-6 overflow-x-auto px-2 pb-3 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {group.videos.map(({ video, meta }, videoIndex) => {
                const displayTitle = useRawTitles ? video.title : meta.title
                const cardSizeClass = 'h-[40rem] lg:h-[31.2rem]'

                return (
                  <FadeIn key={video.id} delay={groupIndex * 90 + videoIndex * 60}>
                    <div
                      className={`w-[min(98vw,77rem)] shrink-0 snap-start overflow-hidden rounded-[30px] border bg-slate-900/60 transition-all duration-300 hover:bg-slate-900/82 sm:w-[72.5rem] ${cardSizeClass} ${getGroupCardStyle(group.key)}`}
                    >
                      <div className="grid h-full grid-cols-[minmax(0,1.2fr)_minmax(24rem,1.8fr)] gap-0">
                        <div className="grid h-full min-h-0 grid-rows-[auto_1fr] p-6 sm:p-7 xl:p-8">
                          <h3 className="max-w-[18ch] text-3xl font-bold leading-tight text-white sm:text-[2.2rem]">
                            {displayTitle}
                          </h3>

                          <div className="mt-6 min-h-0 overflow-hidden">
                            <div className="relative h-full min-h-0 overflow-y-auto px-5 py-5 pr-3 [scrollbar-gutter:stable]">
                              <div className="space-y-4 text-base leading-7 pr-1">
                                {renderMarkdown(video.description)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex h-full items-center justify-center pr-[26px]">
                          <div className="w-full overflow-hidden rounded-[25px] shadow-[0_16px_50px_rgba(2,12,27,0.45)]">
                            <div className="relative h-[14.5rem] sm:h-[16.5rem] lg:h-[25rem]">
                              <iframe
                                className="h-full w-full"
                                src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0&modestbranding=1&list=${playlist.id}`}
                                title={video.title}
                                loading="lazy"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollRowRight(group.key)}
              className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-slate-950/85 p-3 text-white shadow-[0_12px_30px_rgba(2,12,27,0.4)] backdrop-blur transition-colors hover:border-sky-400/40 hover:text-sky-200 md:inline-flex"
              aria-label={`Scroll ${group.meta.title} to the right`}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      ))}

      <section className="px-4 sm:px-0 lg:px-0">
        <FadeIn>
          <div className="max-w-4xl mx-auto text-center rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(99,102,241,0.14),rgba(15,23,42,0.88))] p-12 shadow-[0_20px_80px_rgba(2,12,27,0.35)]">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Want to run these flows in your own repo?
            </h2>
            <p className="text-slate-400 mb-8">
              Install Multimeter, open one of the sample projects, and start building API and test flows without leaving VS Code.
            </p>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-lg shadow-primary/25"
            >
              Install VS Code Extension
              <ArrowRight size={16} />
            </a>
          </div>
        </FadeIn>
      </section>
    </div>
  )
}