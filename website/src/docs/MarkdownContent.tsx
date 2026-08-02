import { Children, isValidElement, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import { Link } from 'react-router-dom'
import type { Components } from 'react-markdown'
import CodeBlock from './CodeBlock'

/** Map Multimeter / common aliases onto highlight.js languages. */
const HIGHLIGHT_ALIASES: Record<string, string> = {
  mmt: 'yaml',
  yml: 'yaml',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  js: 'javascript',
  ts: 'typescript',
  plaintext: 'plaintext',
  text: 'plaintext',
}

/** Tag unlabeled fences that look like Multimeter YAML as yaml. */
function normalizeCodeFences(markdown: string): string {
  return markdown.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (full, info: string, body: string) => {
    const lang = info.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
    if (lang) {
      const mapped = HIGHLIGHT_ALIASES[lang]
      if (mapped && mapped !== lang) {
        return `\`\`\`${mapped}\n${body}\`\`\``
      }
      return full
    }
    if (looksLikeYaml(body)) {
      return `\`\`\`yaml\n${body}\`\`\``
    }
    return full
  })
}

/**
 * VS Code-style `$(icon-name)` → codicon span. Skips fenced code blocks.
 * Docs are first-party content; spans are injected before rehype-raw.
 */
function expandCodiconTokens(markdown: string): string {
  const parts = markdown.split(/(```[\s\S]*?```)/g)
  return parts
    .map((part) => {
      if (part.startsWith('```')) {
        return part
      }
      return part.replace(/\$\(([a-z0-9-]+)\)/gi, (_m, name: string) => {
        const icon = name.toLowerCase()
        return `<span class="codicon codicon-${icon}" aria-hidden="true"></span>`
      })
    })
    .join('')
}

/**
 * UI control chip: `{{btn:icon}}` or `{{btn:icon:Label}}`.
 * Optional `~spin` on the icon name (e.g. `sync~spin`) adds a spin animation.
 * Renders a bordered icon (+ optional label) for “click this control” docs.
 */
function expandUiButtonTokens(markdown: string): string {
  const parts = markdown.split(/(```[\s\S]*?```)/g)
  return parts
    .map((part) => {
      if (part.startsWith('```')) {
        return part
      }
      return part.replace(
        /\{\{btn:([a-z0-9-]+(?:~[a-z0-9-]+)*)(?::([^}]+))?\}\}/gi,
        (_m, iconRaw: string, labelRaw?: string) => {
          const bits = iconRaw.toLowerCase().split('~')
          const icon = bits[0]
          const spin = bits.includes('spin')
          const label = labelRaw?.trim()
          const labelHtml = label
            ? `<span class="docs-ui-btn-label">${escapeHtml(label)}</span>`
            : ''
          const aria = label
            ? ` role="img" aria-label="${escapeHtml(label)}"`
            : ' aria-hidden="true"'
          const iconClass = `codicon codicon-${icon}${spin ? ' docs-ui-btn-spin' : ''}`
          return `<span class="docs-ui-btn"${aria}><span class="${iconClass}" aria-hidden="true"></span>${labelHtml}</span>`
        },
      )
    })
    .join('')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function looksLikeYaml(body: string): boolean {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  if (lines.length === 0) {
    return false
  }
  const keyed = lines.filter((l) => /^[\w.-]+\s*:/.test(l) || l.startsWith('- '))
  return keyed.length >= Math.ceil(lines.length * 0.5)
}

const MEDIA_EXT = /\.(mp4|webm|png|jpe?g|gif|webp|svg)$/i
const VIDEO_EXT = /\.(mp4|webm)$/i

function parseYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/,
  )
  return match?.[1] ?? null
}

function YouTubeEmbed({ id, title }: { id: string; title: string }) {
  return (
    <div className="docs-youtube">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

/** Directory of a docs content path (`quick-start.md` → ``, `files/api.md` → `files`). */
function contentDir(contentPath: string | undefined): string {
  if (!contentPath) {
    return ''
  }
  const normalized = contentPath.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(0, idx) : ''
}

/** Resolve a relative docs asset (media) to the /docs-assets URL. */
export function resolveDocsAsset(src: string | undefined, contentPath: string | undefined): string | undefined {
  if (!src) {
    return src
  }
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('/')) {
    return src
  }

  const baseDir = contentDir(contentPath)
  let joined = src
  if (src.startsWith('./')) {
    joined = baseDir ? `${baseDir}/${src.slice(2)}` : src.slice(2)
  } else if (src.startsWith('../')) {
    const parts = baseDir.split('/').filter(Boolean)
    let rest = src
    while (rest.startsWith('../')) {
      parts.pop()
      rest = rest.slice(3)
    }
    joined = [...parts, rest].join('/')
  } else if (baseDir) {
    joined = `${baseDir}/${src}`
  }

  joined = joined.replace(/\/+/g, '/')
  return `/docs-assets/${joined}`
}

function resolveDocsHref(href: string | undefined, basePath: string, contentPath?: string): string | undefined {
  if (!href) {
    return href
  }
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('#') ||
    href.startsWith('/docs/') ||
    href.startsWith('/docs-assets/') ||
    href.startsWith('/downloads') ||
    href.startsWith('/demos') ||
    href.startsWith('/tutorials')
  ) {
    return href
  }
  if (href.startsWith('/')) {
    return href
  }

  // Media files → static asset URL
  const pathOnly = href.split('#')[0]
  if (MEDIA_EXT.test(pathOnly)) {
    return resolveDocsAsset(href, contentPath)
  }

  // Relative .md → /docs/...
  const withoutHash = href.split('#')[0]
  const hash = href.includes('#') ? `#${href.split('#').slice(1).join('#')}` : ''
  const baseDir = basePath.replace(/\/[^/]*$/, '')
  let joined = withoutHash
  if (withoutHash.startsWith('./')) {
    joined = `${baseDir}/${withoutHash.slice(2)}`
  } else if (withoutHash.startsWith('../')) {
    const parts = baseDir.split('/').filter(Boolean)
    let rest = withoutHash
    while (rest.startsWith('../')) {
      parts.pop()
      rest = rest.slice(3)
    }
    joined = `/${parts.join('/')}/${rest}`
  } else {
    joined = `${baseDir}/${withoutHash}`
  }

  joined = joined
    .replace(/\/index\.md$/, '')
    .replace(/\.md$/, '')
    .replace(/\/+/g, '/')

  if (!joined.startsWith('/docs')) {
    if (
      joined.startsWith('/tasks') ||
      joined.startsWith('/files') ||
      joined.startsWith('/features') ||
      joined.startsWith('/running') ||
      joined.startsWith('/guides') ||
      joined.startsWith('/examples')
    ) {
      joined = `/docs${joined}`
    } else if (
      joined === '/getting-started' ||
      joined === '/install' ||
      joined === '/quick-start' ||
      joined === '/files' ||
      joined === '/tasks'
    ) {
      joined = `/docs${joined}`
    }
  }

  if (joined === '/docs/examples' || joined.endsWith('/examples')) {
    return `/docs/examples${hash}`
  }

  return `${joined}${hash}`
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim() ?? 'Docs'
}

function extractHeadings(markdown: string): Array<{ id: string; text: string; level: number }> {
  const headings: Array<{ id: string; text: string; level: number }> = []
  const lines = markdown.split('\n')
  let inFence = false
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      continue
    }
    const m = line.match(/^(#{2,3})\s+(.+)$/)
    if (!m) {
      continue
    }
    const level = m[1].length
    const text = m[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
    headings.push({ id, text, level })
  }
  return headings
}

type MarkdownContentProps = {
  markdown: string
  /** Current docs URL path, e.g. /docs/tasks/send-api-request */
  basePath: string
  /** Markdown file path under docs/, e.g. quick-start.md */
  contentPath?: string
  showTitle?: boolean
}

export function useDocHeadings(markdown: string) {
  return useMemo(() => extractHeadings(markdown), [markdown])
}

export function getDocTitle(markdown: string): string {
  return extractTitle(markdown)
}

export default function MarkdownContent({
  markdown,
  basePath,
  contentPath,
  showTitle = true,
}: MarkdownContentProps) {
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children, ...rest }) => {
        const resolved = resolveDocsHref(href, basePath, contentPath)
        if (!resolved) {
          return <a {...rest}>{children}</a>
        }

        const youtubeId = parseYouTubeId(resolved)
        if (youtubeId) {
          const childList = Children.toArray(children)
          const hasMediaChild = childList.some((child) => {
            if (!isValidElement(child)) {
              return false
            }
            const props = child.props as { src?: string; alt?: string }
            if (typeof props.src === 'string') {
              return true
            }
            return child.type === 'img'
          })
          const text = childList
            .map((child) => (typeof child === 'string' ? child : ''))
            .join('')
            .trim()
          const isAutolink = !text || text === resolved || text === href || text === `https://youtu.be/${youtubeId}`
          if (hasMediaChild || isAutolink) {
            const imgChild = childList.find((child) => isValidElement(child))
            const title =
              (isValidElement(imgChild) && typeof (imgChild.props as { alt?: string }).alt === 'string'
                ? (imgChild.props as { alt?: string }).alt
                : undefined) ||
              text ||
              'YouTube video'
            return <YouTubeEmbed id={youtubeId} title={title || 'YouTube video'} />
          }
        }

        if (resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('mailto:')) {
          return (
            <a href={resolved} target="_blank" rel="noopener noreferrer" {...rest}>
              {children}
            </a>
          )
        }
        if (resolved.startsWith('#')) {
          return (
            <a href={resolved} {...rest}>
              {children}
            </a>
          )
        }
        if (resolved.startsWith('/docs-assets/')) {
          return (
            <a href={resolved} {...rest}>
              {children}
            </a>
          )
        }
        return (
          <Link to={resolved} {...rest}>
            {children}
          </Link>
        )
      },
      img: ({ src, alt, ...rest }) => {
        const resolved = resolveDocsAsset(src, contentPath)
        if (resolved && VIDEO_EXT.test(resolved)) {
          return (
            <video
              className="docs-video"
              controls
              playsInline
              preload="metadata"
              src={resolved}
              title={alt || 'Video'}
            >
              <a href={resolved}>{alt || 'Download video'}</a>
            </video>
          )
        }
        return <img src={resolved} alt={alt ?? ''} {...rest} />
      },
      h1: showTitle
        ? ({ children, ...rest }) => (
            <h1 {...rest}>{children}</h1>
          )
        : () => null,
      pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    }),
    [basePath, contentPath, showTitle],
  )

  const source = useMemo(
    () => expandCodiconTokens(expandUiButtonTokens(normalizeCodeFences(markdown))),
    [markdown],
  )

  return (
    <div className="docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap', properties: { className: ['docs-heading-link'] } }],
          [rehypeHighlight, { detect: false, aliases: HIGHLIGHT_ALIASES }],
        ]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
