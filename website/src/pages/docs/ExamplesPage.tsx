import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, FileCode2, FolderOpen } from 'lucide-react'
import { examples } from 'virtual:examples'
import type { ExampleEntry, ExampleTier } from 'virtual:examples'
import MarkdownContent from '../../docs/MarkdownContent'

const TIER_ORDER: ExampleTier[] = ['basic', 'intermediate', 'professional']
const TIER_LABEL: Record<ExampleTier, string> = {
  basic: 'Basic',
  intermediate: 'Intermediate',
  professional: 'Professional',
}

function groupByTier(list: ExampleEntry[]) {
  return TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABEL[tier],
    items: list.filter((e) => e.tier === tier),
  })).filter((g) => g.items.length > 0)
}

export function ExamplesIndexPage() {
  const groups = useMemo(() => groupByTier(examples), [])

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-white mb-3">Examples</h1>
      <p className="text-slate-400 mb-8">
        Real folders from the Multimeter repo. Open one to read the README and browse every{' '}
        <code className="text-accent">.mmt</code> file.
      </p>

      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.tier}>
            <h2 className="text-lg font-semibold text-white mb-4">{group.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.items.map((item) => (
                <Link
                  key={`${item.tier}/${item.slug}`}
                  to={`/docs/examples/${item.tier}/${item.slug}`}
                  className="block rounded-xl border border-border bg-surface-light/50 hover:border-primary/40 hover:bg-surface-light p-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FolderOpen size={18} className="text-primary-light" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-white mb-1">{item.title}</h3>
                      {item.description ? (
                        <p className="text-sm text-slate-400 line-clamp-2">{item.description}</p>
                      ) : (
                        <p className="text-sm text-slate-500 font-mono">{item.slug}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

type TreeNode = { name: string; path?: string; children?: TreeNode[] }

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const filePath of paths) {
    const parts = filePath.split('/')
    let level = root
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isFile = i === parts.length - 1
      let node = level.find((n) => n.name === name && Boolean(n.path) === isFile)
      if (!node) {
        node = isFile ? { name, path: filePath } : { name, children: [] }
        level.push(node)
      }
      if (!isFile) {
        if (!node.children) {
          node.children = []
        }
        level = node.children
      }
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const aDir = !a.path
      const bDir = !b.path
      if (aDir !== bDir) {
        return aDir ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) {
      if (n.children) {
        sortNodes(n.children)
      }
    }
  }
  sortNodes(root)
  return root
}

function FileTreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode
  depth: number
  selected: string
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const isDir = !node.path

  if (isDir) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-1 text-left text-sm text-slate-400 hover:text-white py-0.5"
          style={{ paddingLeft: depth * 12 }}
        >
          <ChevronRight size={14} className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="truncate">{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <FileTreeNode
              key={`${node.name}/${child.name}`}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
      </div>
    )
  }

  const active = selected === node.path
  return (
    <button
      type="button"
      onClick={() => node.path && onSelect(node.path)}
      className={`w-full flex items-center gap-1.5 text-left text-sm py-0.5 truncate ${
        active ? 'text-primary-light' : 'text-slate-400 hover:text-white'
      }`}
      style={{ paddingLeft: depth * 12 + 14 }}
    >
      <FileCode2 size={14} className="shrink-0 opacity-70" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function ExampleDetailPage() {
  const { tier, slug } = useParams<{ tier: string; slug: string }>()
  const example = examples.find((e) => e.tier === tier && e.slug === slug)

  const defaultFile =
    example?.files.find((f) => f.path.endsWith('.mmt'))?.path ??
    example?.files.find((f) => f.path === 'README.md')?.path ??
    example?.files[0]?.path ??
    ''

  const [selectedPath, setSelectedPath] = useState(defaultFile)

  useEffect(() => {
    setSelectedPath(defaultFile)
  }, [defaultFile, tier, slug])

  const selected = example?.files.find((f) => f.path === selectedPath) ?? example?.files[0]
  const tree = useMemo(
    () => (example ? buildTree(example.files.map((f) => f.path)) : []),
    [example],
  )
  const readme = example?.files.find((f) => f.path === 'README.md')

  if (!example) {
    return (
      <div className="py-12">
        <h1 className="text-2xl font-bold text-white mb-2">Example not found</h1>
        <Link to="/docs/examples" className="text-primary-light hover:underline">
          Back to examples
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-primary-light mb-2">
          <Link to="/docs/examples" className="hover:underline">
            Examples
          </Link>
          <span className="text-slate-600 mx-1.5">/</span>
          <span className="capitalize text-slate-400">{example.tier}</span>
        </p>
        <h1 className="text-3xl font-bold text-white mb-2">{example.title}</h1>
        {example.description ? <p className="text-slate-400">{example.description}</p> : null}
      </div>

      {readme ? (
        <div className="rounded-xl border border-border bg-surface-light/30 p-5">
          <MarkdownContent
            markdown={readme.content}
            basePath={`/docs/examples/${example.tier}/${example.slug}`}
          />
        </div>
      ) : null}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-surface-light/50 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-white">Files</span>
          <span className="text-xs text-slate-500 font-mono truncate">{selected?.path}</span>
        </div>
        <div className="grid lg:grid-cols-[220px_1fr] min-h-[280px]">
          <div className="border-b lg:border-b-0 lg:border-r border-border p-3 bg-surface/80 max-h-[420px] overflow-y-auto">
            {tree.map((node) => (
              <FileTreeNode
                key={node.path ?? node.name}
                node={node}
                depth={0}
                selected={selected?.path ?? ''}
                onSelect={setSelectedPath}
              />
            ))}
          </div>
          <div className="p-0 max-h-[420px] overflow-auto">
            {selected ? (
              <pre className="m-0 p-4 text-sm leading-relaxed text-slate-300 font-mono whitespace-pre-wrap break-words">
                <code>{selected.content}</code>
              </pre>
            ) : (
              <p className="p-4 text-slate-500 text-sm">Select a file</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
