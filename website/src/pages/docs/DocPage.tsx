import { Link, useLocation } from 'react-router-dom'
import { getDocMarkdown } from '../../docs/loadContent'
import MarkdownContent, { getDocTitle, useDocHeadings } from '../../docs/MarkdownContent'
import { findNavItem } from '../../docs/nav'

function OnThisPage({ headings }: { headings: Array<{ id: string; text: string; level: number }> }) {
  if (headings.length < 2) {
    return null
  }
  return (
    <aside className="hidden xl:block w-48 shrink-0 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        On this page
      </h2>
      <ul className="space-y-1.5 border-l border-border">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block text-sm text-slate-500 hover:text-primary-light transition-colors ${
                h.level === 3 ? 'pl-5' : 'pl-3'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export default function DocPage() {
  const location = useLocation()
  const basePath = location.pathname.replace(/\/$/, '') || '/docs'
  const navItem = findNavItem(basePath)
  const contentPath = navItem?.content

  if (!contentPath) {
    return (
      <div className="py-12">
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-slate-400 mb-4">No docs page for {basePath}</p>
        <Link to="/docs/quick-start" className="text-primary-light hover:underline">
          Back to Getting Started
        </Link>
      </div>
    )
  }

  const markdown = getDocMarkdown(contentPath)
  const headings = useDocHeadings(markdown ?? '')

  if (!markdown) {
    return (
      <div className="py-12">
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-slate-400 mb-4">Missing content: {contentPath}</p>
        <Link to="/docs/quick-start" className="text-primary-light hover:underline">
          Back to Getting Started
        </Link>
      </div>
    )
  }

  const title = getDocTitle(markdown)

  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1 max-w-3xl">
        <MarkdownContent markdown={markdown} basePath={basePath} contentPath={contentPath} />
        <span className="sr-only">{title}</span>
      </article>
      <OnThisPage headings={headings} />
    </div>
  )
}
