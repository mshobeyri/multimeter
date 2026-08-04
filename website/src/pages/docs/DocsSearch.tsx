import { useDeferredValue, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { searchDocs, type DocsSearchHit } from '../../docs/searchIndex'

type DocsSearchProps = {
  onNavigate: () => void
  onSearchingChange?: (searching: boolean) => void
}

export default function DocsSearch({ onNavigate, onSearchingChange }: DocsSearchProps) {
  const inputId = useId()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [activeIndex, setActiveIndex] = useState(0)

  const hits: DocsSearchHit[] =
      deferredQuery.trim().length > 0 ? searchDocs(deferredQuery) : []
  const searching = query.trim().length > 0

  useEffect(() => {
    onSearchingChange?.(searching)
  }, [searching, onSearchingChange])

  useEffect(() => {
    setActiveIndex(0)
  }, [deferredQuery])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isModK =
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === 'k'
      if (!isModK) {
        return
      }
      event.preventDefault()
      const input = rootRef.current?.querySelector('input')
      input?.focus()
      input?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const clear = () => {
    setQuery('')
    setActiveIndex(0)
  }

  const handleNavigate = () => {
    clear()
    onNavigate()
  }

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!searching || hits.length === 0) {
      if (event.key === 'Escape' && query) {
        event.preventDefault()
        clear()
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, hits.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      const hit = hits[activeIndex]
      if (hit) {
        event.preventDefault()
        const link = rootRef.current?.querySelector<HTMLAnchorElement>(
            `[data-docs-search-index="${activeIndex}"]`)
        link?.click()
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      clear()
    }
  }

  return (
    <div ref={rootRef} className="mb-5 px-1.5">
      <label htmlFor={inputId} className="sr-only">
        Search docs
      </label>
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Search docs…"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={searching}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            searching && hits[activeIndex]
              ? `${listId}-option-${activeIndex}`
              : undefined
          }
          className="w-full rounded-xl border border-border bg-surface-light py-2 pl-8 pr-16 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="rounded p-0.5 text-slate-500 hover:text-white"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {searching ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="mt-2 max-h-[min(24rem,50vh)] overflow-y-auto rounded-xl border border-border bg-surface-light/80"
        >
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">
              No results for “{query.trim()}”
            </p>
          ) : (
            <ul className="py-1">
              {hits.map((hit, index) => (
                <li key={hit.href} role="presentation">
                  <Link
                    id={`${listId}-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    data-docs-search-index={index}
                    to={hit.href}
                    onClick={handleNavigate}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`block px-3 py-2 text-sm transition-colors ${
                      index === activeIndex
                        ? 'bg-primary/15 text-primary-light'
                        : 'text-slate-300 hover:bg-surface hover:text-white'
                    }`}
                  >
                    <span className="block font-medium truncate">{hit.title}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      {hit.section}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
