import { useState, type ReactNode } from 'react'
import { MonitorPlay, ArrowRight } from 'lucide-react'
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

function shouldCollapseDescription(description: string): boolean {
  const normalized = description
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')

  return normalized.length > 260 || normalized.split('\n').length > 8
}

interface TutorialPlaylistShowcaseProps {
  playlist: PlaylistData
  reverseVideos?: boolean
  useRawTitles?: boolean
  showPrefixBadge?: boolean
}

export default function TutorialPlaylistShowcase({
  playlist,
  reverseVideos = false,
  useRawTitles = false,
  showPrefixBadge = true,
}: TutorialPlaylistShowcaseProps) {
  const [expandedVideos, setExpandedVideos] = useState<Record<string, boolean>>({})
  const videos = reverseVideos ? [...playlist.videos].reverse() : playlist.videos

  const toggleExpanded = (videoId: string) => {
    setExpandedVideos((current) => ({
      ...current,
      [videoId]: !current[videoId],
    }))
  }

  return (
    <div className="space-y-8">
      {videos.map((video, videoIndex) => {
        const meta = titleMeta(video.title)
        const isExpanded = !!expandedVideos[video.id]
        const canCollapse = shouldCollapseDescription(video.description)
        const displayTitle = useRawTitles ? video.title : meta.title

        return (
          <FadeIn key={video.id} delay={videoIndex * 75}>
            <div className="overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/60 transition-all duration-300">
              <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-col justify-between p-7 sm:p-8 xl:p-10">
                  <div>
                    {showPrefixBadge && (
                      <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-sky-200">
                        <MonitorPlay size={12} />
                        {meta.prefix}
                      </div>
                    )}
                    <h3 className="mt-5 text-2xl font-bold leading-tight text-white sm:text-3xl">
                      {displayTitle}
                    </h3>
                    <div className="mt-5">
                      <div className={`relative pr-1 ${canCollapse && !isExpanded ? 'max-h-[18rem] overflow-hidden' : ''}`}>
                        <div className="space-y-4 text-sm">
                          {renderMarkdown(video.description)}
                        </div>
                        {canCollapse && !isExpanded && (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/95 via-slate-900/70 to-transparent" />
                        )}
                      </div>
                      {canCollapse && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(video.id)}
                          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition-colors hover:text-sky-200"
                        >
                          {isExpanded ? 'See less' : 'See more'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/8 bg-slate-950/65 p-4 sm:p-5 lg:border-l lg:border-t-0">
                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950 shadow-[0_16px_50px_rgba(2,12,27,0.45)]">
                    <div className="relative aspect-video bg-slate-950">
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

      <section className="px-4 sm:px-0 lg:px-0">
        <FadeIn>
          <div className="mx-auto max-w-4xl rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(99,102,241,0.14),rgba(15,23,42,0.88))] p-12 text-center shadow-[0_20px_80px_rgba(2,12,27,0.35)]">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
              Want to run these flows in your own repo?
            </h2>
            <p className="mb-8 text-slate-400">
              Install Multimeter, open one of the sample projects, and start building API and test flows without leaving VS Code.
            </p>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white transition-all shadow-lg shadow-primary/25 hover:bg-primary-dark"
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