type CodiconProps = {
  /** Icon name without `codicon-` prefix, e.g. `beaker` */
  name: string
  className?: string
  title?: string
  /** Decorative by default; set title for an accessible name */
  'aria-hidden'?: boolean | 'true' | 'false'
}

/** VS Code Codicon for marketing/docs React pages. */
export default function Codicon({
  name,
  className = '',
  title,
  'aria-hidden': ariaHidden,
}: CodiconProps) {
  const icon = name.startsWith('codicon-') ? name.slice('codicon-'.length) : name
  const decorative = ariaHidden !== false && ariaHidden !== 'false' && !title
  return (
    <span
      className={`codicon codicon-${icon} ${className}`.trim()}
      title={title}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={decorative ? true : undefined}
    />
  )
}
