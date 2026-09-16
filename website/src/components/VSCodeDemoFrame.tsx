import type { ReactNode } from 'react'
import Codicon from './Codicon'

const ACTIVITY_ICONS = ['files', 'search', 'source-control', 'debug-alt', 'extensions'] as const

export function VSCodeLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17.4 3.2 8.7 11 3.8 7.3 2 8.6l4.9 3.5L2 15.8l1.8 1.3 4.9-3.7 8.7 7.4L22 18.9V5.1l-4.6-1.9Z"
        fill="#38BDF8"
      />
      <path d="M17.4 7.1v9.8l-6.3-4.8 6.3-5Z" fill="#0EA5E9" />
      <path d="M17.4 3.2v17.6L22 18.9V5.1l-4.6-1.9Z" fill="#0284C7" />
    </svg>
  )
}

export function VSCodeActivityBar() {
  return (
    <div className="hero-activity-bar pt-5 pb-3 gap-1 border-r border-border bg-surface-light/70">
      <div className="mb-4 flex h-9 w-9 items-center justify-center" title="VS Code">
        <VSCodeLogo />
      </div>
      {ACTIVITY_ICONS.map((name, index) => (
        <span
          key={name}
          className={`flex h-8 w-8 items-center justify-center ${
            index === 0
              ? 'text-slate-200 border-l-2 border-primary-light bg-white/5'
              : 'text-slate-500'
          }`}
          aria-hidden="true"
        >
          <Codicon name={name} className="text-base" />
        </span>
      ))}
    </div>
  )
}

export type VSCodeEditorTab = {
  id: string
  label: string
  icon: string
  active?: boolean
}

export function VSCodeEditorTabs({
  tabs,
  onTabClick,
}: {
  tabs: VSCodeEditorTab[]
  onTabClick?: (id: string) => void
}) {
  return (
    <div className="flex items-stretch border-b border-border bg-surface-light/40 min-h-9">
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.active !== false
          const Tag = onTabClick ? 'button' : 'div'
          return (
            <Tag
              key={tab.id}
              {...(onTabClick
                ? { type: 'button' as const, onClick: () => onTabClick(tab.id) }
                : {})}
              className={`group flex items-center gap-1.5 px-3 h-9 text-[11px] sm:text-xs shrink-0 border-r border-border ${
                active
                  ? 'bg-surface text-slate-200 border-t-2 border-t-primary-light'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface/60 border-t-2 border-t-transparent'
              }`}
            >
              <Codicon name={tab.icon} className="text-sm opacity-80" />
              <span>{tab.label}</span>
              <span
                className={`ml-1 text-[10px] leading-none ${
                  active ? 'text-slate-500' : 'text-slate-600 group-hover:text-slate-400'
                }`}
                aria-hidden="true"
              >
                ×
              </span>
            </Tag>
          )
        })}
      </div>
    </div>
  )
}

export function YamlLine({ line, colonIdx }: { line: string; colonIdx: number }) {
  const indent = line.match(/^(\s*)/)?.[1] || ''
  const keyword = line.slice(indent.length, colonIdx)
  const rest = line.slice(colonIdx)
  const valueStart = rest.indexOf(' ')
  const colon = valueStart === -1 ? rest : rest.slice(0, 2)
  const value = valueStart === -1 ? '' : rest.slice(2)
  return (
    <span style={{ paddingLeft: `${(indent.length / 2) * 12}px` }}>
      <span className="text-primary-light">{keyword}</span>
      <span className="text-slate-500">{colon}</span>
      {value ? <span className="text-accent">{value}</span> : null}
    </span>
  )
}

export function YamlEditorPane({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-[240px] sm:min-h-0 bg-[#0b1220]">
      <div className="flex-1 overflow-auto p-3 sm:p-4 font-mono text-[11px] sm:text-xs leading-6 text-left">
        {lines.map((line, i) => {
          const colonIdx = line.indexOf(':')
          return (
            <div key={i} className="grid grid-cols-[2.25rem_minmax(0,1fr)] whitespace-pre">
              <span className="select-none text-right pr-3 text-slate-600">{i + 1}</span>
              {colonIdx === -1 ? (
                <span className="text-slate-300">{line}</span>
              ) : (
                <YamlLine line={line} colonIdx={colonIdx} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function VSCodeSidePanel({
  title,
  icon,
  action,
  children,
  fullWidth = false,
}: {
  title: string
  icon: string
  action?: ReactNode
  children: ReactNode
  /** When true, panel fills the editor area (no split-pane left border). */
  fullWidth?: boolean
}) {
  return (
    <div
      className={`flex-1 flex flex-col min-w-0 text-left bg-surface ${
        fullWidth ? 'border-t border-border sm:border-t-0' : 'border-t sm:border-t-0 sm:border-l border-border'
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Codicon name={icon} className="text-slate-300" />
          <span className="text-xs sm:text-sm text-slate-200 truncate">{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function VSCodeDemoFrame({
  children,
  minHeightClass = 'min-h-[520px] sm:min-h-[620px]',
}: {
  children: ReactNode
  minHeightClass?: string
}) {
  return (
    <div className="glow rounded-2xl overflow-clip border border-border bg-surface">
      <div className={`flex ${minHeightClass}`}>
        <VSCodeActivityBar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
