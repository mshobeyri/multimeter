#!/usr/bin/env node
/** Rewrite common docs path references after the files-reference restructure. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const replacements = [
  // Prefer index paths for file types
  [/docs\/files\/api\.md/g, 'docs/files/api/index.md'],
  [/docs\/files\/test\.md/g, 'docs/files/test/index.md'],
  [/docs\/files\/env\.md/g, 'docs/files/env/index.md'],
  [/docs\/files\/suite\.md/g, 'docs/files/suite/index.md'],
  [/docs\/files\/doc\.md/g, 'docs/files/doc/index.md'],
  [/docs\/files\/server\.md/g, 'docs/files/server/index.md'],
  [/docs\/files\/loadtest\.md/g, 'docs/files/loadtest/index.md'],
  [/docs\/files\/report\.md/g, 'docs/files/report/index.md'],
  [/docs\/guides\/mcp\.md/g, 'docs/features/mcp.md'],
  [/docs\/guides\/testgen-profile-ai\.md/g, 'docs/integration/testgen-profile-ai.md'],
  [/docs\/guides\/testgen-profile\.md/g, 'docs/integration/testgen-profile.md'],
  [/docs\/guides\/sample-project\.md/g, 'docs/sample-project/index.md'],
  [/docs\/guides\/mmt-overview\.md/g, 'docs/overview.md'],
  [/docs\/features\/http-files\.md/g, 'docs/integration/http-files.md'],
  [/docs\/features\/bruno-files\.md/g, 'docs/integration/bruno-files.md'],
  [/docs\/features\/convertor\.md/g, 'docs/integration/convertor/index.md'],
  [/docs\/features\/data-imports\.md/g, 'docs/integration/data-imports.md'],
  // relative from docs/
  [/\.\/files\/api\.md/g, './files/api/index.md'],
  [/\.\/files\/test\.md/g, './files/test/index.md'],
  [/\.\/files\/env\.md/g, './files/env/index.md'],
  [/\.\/files\/suite\.md/g, './files/suite/index.md'],
  [/\.\/files\/doc\.md/g, './files/doc/index.md'],
  [/\.\/files\/server\.md/g, './files/server/index.md'],
  [/\.\/files\/loadtest\.md/g, './files/loadtest/index.md'],
  [/\.\/files\/report\.md/g, './files/report/index.md'],
  [/\.\.\/features\/data-imports\.md/g, '../integration/data-imports.md'],
  [/\.\.\/features\/convertor\.md/g, '../integration/convertor/index.md'],
  [/\.\.\/features\/http-files\.md/g, '../integration/http-files.md'],
  [/\.\.\/features\/bruno-files\.md/g, '../integration/bruno-files.md'],
  [/\.\.\/guides\/mcp\.md/g, '../features/mcp.md'],
  [/\.\.\/guides\/mmt-overview\.md/g, '../overview.md'],
  [/\.\.\/guides\/sample-project\.md/g, '../sample-project/index.md'],
  [/\.\.\/guides\/testgen-profile-ai\.md/g, '../integration/testgen-profile-ai.md'],
  [/\.\.\/guides\/testgen-profile\.md/g, '../integration/testgen-profile.md'],
]

const skipDirs = new Set(['node_modules', 'dist', '.git', 'coverage', 'out'])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue
      walk(full, out)
    } else if (/\.(md|ts|tsx|js|json|mdx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

let changed = 0
for (const file of walk(root)) {
  if (file.includes(`${path.sep}scripts${path.sep}split-docs`)) continue
  if (file.includes(`${path.sep}scripts${path.sep}rewrite-docs`)) continue
  let text = fs.readFileSync(file, 'utf8')
  let next = text
  for (const [re, to] of replacements) {
    next = next.replace(re, to)
  }
  if (next !== text) {
    fs.writeFileSync(file, next)
    changed++
    console.log('updated', path.relative(root, file))
  }
}
console.log(`Changed ${changed} files`)
