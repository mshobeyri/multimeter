import { useCallback, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join('')
  }
  if (typeof node === 'object' && 'props' in node) {
    const props = node.props as { children?: ReactNode }
    return extractText(props.children)
  }
  return ''
}

export default function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)

  const onCopy = useCallback(async () => {
    const text = extractText(children).replace(/\n$/, '')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore clipboard failures (insecure context, permissions)
    }
  }, [children])

  return (
    <div className="docs-codeblock">
      <button
        type="button"
        className="docs-codeblock-copy"
        onClick={onCopy}
        aria-label={copied ? 'Copied' : 'Copy code'}
        title={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check size={14} strokeWidth={2.25} /> : <Copy size={14} strokeWidth={2.25} />}
      </button>
      <pre>{children}</pre>
    </div>
  )
}
