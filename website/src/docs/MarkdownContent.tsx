import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import { Link } from 'react-router-dom'
import type { Components } from 'react-markdown'

function resolveDocsHref(href: string | undefined, basePath: string): string | undefined {
  if (!href) {
    return href
  }
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('#') ||
    href.startsWith('/docs/') ||
    href.startsWith('/downloads') ||
    href.startsWith('/demos') ||
    href.startsWith('/tutorials')
  ) {
    return href
  }
  if (href.startsWith('/')) {
    return href
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
    // Map content-relative paths onto /docs
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

  // Special: ./examples without /docs prefix from getting-started
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
  showTitle?: boolean
}

export function useDocHeadings(markdown: string) {
  return useMemo(() => extractHeadings(markdown), [markdown])
}

export function getDocTitle(markdown: string): string {
  return extractTitle(markdown)
}

export default function MarkdownContent({ markdown, basePath, showTitle = true }: MarkdownContentProps) {
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children, ...rest }) => {
        const resolved = resolveDocsHref(href, basePath)
        if (!resolved) {
          return <a {...rest}>{children}</a>
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
        return (
          <Link to={resolved} {...rest}>
            {children}
          </Link>
        )
      },
      h1: showTitle
        ? ({ children, ...rest }) => (
            <h1 {...rest}>{children}</h1>
          )
        : () => null,
    }),
    [basePath, showTitle],
  )

  return (
    <div className="docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap', properties: { className: ['docs-heading-link'] } }],
        ]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
