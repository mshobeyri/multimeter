#!/usr/bin/env node
/**
 * One-shot docs restructure: split long file-type docs into short pages,
 * extract protocols, create integration section, retire guides.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docs = path.join(root, 'docs')

function read(rel) {
  return fs.readFileSync(path.join(docs, rel), 'utf8')
}

function write(rel, content) {
  const full = path.join(docs, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  const body = content.trimEnd() + '\n'
  fs.writeFileSync(full, body)
  console.log('write', rel, `(${body.split(/\s+/).filter(Boolean).length}w)`)
}

function rm(rel) {
  const full = path.join(docs, rel)
  if (fs.existsSync(full)) {
    fs.unlinkSync(full)
    console.log('rm', rel)
  }
}

function move(from, to) {
  const src = path.join(docs, from)
  const dest = path.join(docs, to)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.renameSync(src, dest)
  console.log('mv', from, '→', to)
}

/** Slice lines [start, end) 1-based inclusive start, exclusive end (or null = EOF) */
function sliceLines(text, start, end = null) {
  const lines = text.split('\n')
  const chunk = lines.slice(start - 1, end == null ? undefined : end - 1)
  return chunk.join('\n').trim() + '\n'
}

function demoteH1(section, title) {
  // Ensure page has a single # title; convert leading ## of extracted section to keep hierarchy
  let s = section.trim()
  if (s.startsWith('## ')) {
    s = '# ' + s.slice(3)
  } else if (!s.startsWith('# ')) {
    s = `# ${title}\n\n${s}`
  }
  return s + '\n'
}

function fixLinks(text, fromDir) {
  // fromDir e.g. 'files/api' — rewrite common old relative links
  return text
    .replace(/\]\(\.\.\/features\/data-imports\.md\)/g, '](../../integration/data-imports.md)')
    .replace(/\]\(\.\.\/features\/convertor\.md\)/g, '](../../integration/convertor/index.md)')
    .replace(/\]\(\.\.\/features\/certificates\.md\)/g, '](../../features/certificates.md)')
    .replace(/\]\(\.\.\/features\/history\.md\)/g, '](../../features/history.md)')
    .replace(/\]\(\.\/api\.md/g, '](../api/index.md')
    .replace(/\]\(\.\/test\.md/g, '](../test/index.md')
    .replace(/\]\(\.\/env\.md/g, '](../env/index.md')
    .replace(/\]\(\.\/suite\.md/g, '](../suite/index.md')
    .replace(/\]\(\.\/doc\.md/g, '](../doc/index.md')
    .replace(/\]\(\.\/server\.md/g, '](../server/index.md')
    .replace(/\]\(\.\/loadtest\.md/g, '](../loadtest/index.md')
    .replace(/\]\(\.\/report\.md/g, '](../report/index.md')
}

// ---------- API + protocols ----------
{
  const api = read('files/api.md')

  write(
    'protocols/index.md',
    `# Protocols

Multimeter APIs support HTTP, WebSocket, GraphQL, and gRPC.

| Protocol | When to use | Docs |
|---|---|---|
| [HTTP](./http.md) | REST and general HTTP requests | Bodies, methods, formats |
| [WebSocket](./websocket.md) | Live bidirectional messaging | Connect + test frames |
| [GraphQL](./graphql.md) | GraphQL over HTTP | \`graphql\` block |
| [gRPC](./grpc.md) | Protobuf RPC | \`grpc\` block |

Shared request fields (\`url\`, \`headers\`, \`auth\`, \`inputs\`/\`outputs\`) are documented under [API files](../files/api/index.md).
`,
  )

  // HTTP: quick-start HTTP subsections + request-oriented notes (no GraphQL/gRPC/WS)
  const httpQuick = sliceLines(api, 17, 171) // ### HTTP GET … before ### WebSocket
  write(
    'protocols/http.md',
    demoteH1(
      `## HTTP\n\nDefault protocol for most APIs. Inferred from the URL unless you set \`protocol: http\`.\n\n${httpQuick}`,
      'HTTP',
    ),
  )

  const wsQuick = sliceLines(api, 171, 183)
  const wsComplete = sliceLines(api, 787, 799)
  write(
    'protocols/websocket.md',
    `# WebSocket

Use \`protocol: ws\` (or a \`ws://\` / \`wss://\` URL) for bidirectional messaging.

${wsQuick.replace(/^### WebSocket\n/, '')}

## Complete example

${wsComplete.replace(/^### WS\n/, '')}

Tip: drive frames from [test \`call\` steps](../files/test/call.md). Live sessions also appear in the Connections panel.
`,
  )

  const gqlQuick = sliceLines(api, 183, 208)
  const gqlFull = sliceLines(api, 384, 445)
  const gqlComplete = sliceLines(api, 799, 851)
  write(
    'protocols/graphql.md',
    `# GraphQL

${gqlQuick.replace(/^### GraphQL\n/, '')}

${gqlFull.replace(/^## GraphQL\n/, '## Details\n')}

## Complete example

${gqlComplete.replace(/^### GraphQL\n/, '')}
`,
  )

  const grpcQuick = sliceLines(api, 208, 230)
  const grpcFull = sliceLines(api, 445, 518)
  write(
    'protocols/grpc.md',
    `# gRPC

${grpcQuick.replace(/^### gRPC\n/, '')}

${grpcFull.replace(/^## gRPC\n/, '## Details\n')}
`,
  )

  // API folder pages
  write(
    'files/api/index.md',
    `# API

Write request definitions in \`.mmt\` files with \`type: api\`.

**Supported**
- Protocols: [HTTP](../../protocols/http.md), [WebSocket](../../protocols/websocket.md), [GraphQL](../../protocols/graphql.md), [gRPC](../../protocols/grpc.md)
- Formats: \`json\`, \`xml\`, \`xmle\`, \`text\`, \`urlencoded\`, \`binary\`
- Methods: \`get\`, \`post\`, \`put\`, \`delete\`, \`patch\`, \`head\`, \`options\`, \`trace\`

## Request

\`url\`, \`method\`, \`headers\`, \`query\`, and \`cookies\` are documented in this overview. Body and format: [Body](./body/index.md).

## API elements

- [Documentation](./documentation.md) — title, tags, description
- [Protocols](./protocols/index.md) · [Body](./body/index.md)
- [Headers](./headers.md) · [Auth](./auth.md)
- [Inputs](./inputs.md) · [Outputs](./outputs.md) · [setenv](./setenv.md)
- [Examples](./examples.md) · [Dynamic values](../../features/dynamic-values.md)
- [Reference](./reference.md)

See also: [Quick start](./quick-start.md) · [Complete examples](./complete-examples.md) · [Protocols](../../protocols/index.md)
`,
  )

  write(
    'files/api/quick-start.md',
    `# API quick start

Minimal HTTP GET:

\`\`\`yaml
type: api
url: <<e:api_url>>/users
method: get
format: json
headers:
  Session: e:token
query:
  limit: "10"
\`\`\`

- \`format\` encodes/decodes the body (default \`json\`)
- \`query\` merges with any query string in \`url\`
- Protocol is inferred from the URL (\`ws://\` → WebSocket, otherwise HTTP)

Dynamic tokens work in url/headers/body/query/cookies: \`r:uuid\`, \`c:epoch\`, \`e:token\`. See [Dynamic values](../../features/dynamic-values.md).

Import JSON/YAML/CSV with top-level \`import:\` — [Data imports](../../integration/data-imports.md).

Paste a \`curl\` into the API editor to convert it; the toolbar can also run HTTP via \`curl\`.

More protocols: [HTTP bodies](../../protocols/http.md) · [WebSocket](../../protocols/websocket.md) · [GraphQL](../../protocols/graphql.md) · [gRPC](../../protocols/grpc.md)
`,
  )

  write(
    'files/api/documentation.md',
    demoteH1(sliceLines(api, 241, 275), 'Documentation'),
  )
  // Request content stays in files/api/index.md (no separate request.md)
  write('files/api/headers.md', demoteH1(sliceLines(api, 308, 330), 'Headers'))
  write('files/api/auth.md', demoteH1(sliceLines(api, 330, 384), 'Auth'))
  write('files/api/inputs.md', demoteH1(sliceLines(api, 521, 570), 'Inputs'))
  write('files/api/outputs.md', demoteH1(sliceLines(api, 570, 656), 'Outputs'))
  write('files/api/setenv.md', demoteH1(sliceLines(api, 656, 677), 'setenv'))
  write(
    'features/dynamic-values.md',
    demoteH1(sliceLines(api, 677, 725), 'Dynamic values'),
  )
  write(
    'files/api/examples.md',
    demoteH1(
      sliceLines(api, 725, 759).replace(/^## Validation[\s\S]*/m, (m) => m) +
        '\n' +
        sliceLines(api, 746, 759),
      'Examples',
    ),
  )
  // Fix examples.md properly
  write(
    'files/api/examples.md',
    `# Examples, validation, and UI

${sliceLines(api, 725, 746).replace(/^## Examples\n/, '')}

## Validation and requirements

${sliceLines(api, 746, 752).replace(/^## Validation and requirements\n/, '')}

## UI features

${sliceLines(api, 752, 759).replace(/^## UI features\n/, '')}
`,
  )
  write(
    'files/api/complete-examples.md',
    `# Complete examples

HTTP and protocol samples. GraphQL/WS live under [Protocols](../../protocols/index.md) as well.

${sliceLines(api, 761, 851).replace(/^### /gm, '## ')}
`,
  )
  write(
    'files/api/reference.md',
    demoteH1(sliceLines(api, 851, 873), 'Reference'),
  )

  // stub redirect note at old path
  write(
    'files/api.md',
    `# API

This page moved into short sections under [API](./api/index.md).

Start with the [overview](./api/index.md) or [quick start](./api/quick-start.md). Protocols: [HTTP](../protocols/http.md), [WebSocket](../protocols/websocket.md), [GraphQL](../protocols/graphql.md), [gRPC](../protocols/grpc.md).
`,
  )
}

// ---------- TEST ----------
{
  const test = read('files/test.md')
  const intro = sliceLines(test, 1, 45)

  write(
    'files/test/index.md',
    `# Test

${intro.replace(/^# Test\n*/, '')}

## Structure

- [import](./import.md) · [cache](./cache.md)
- [Stages & steps](./stages.md)
- Steps: [call](./call.md) · [http](./http.md) · [run](./run.md) · [assert](./assert.md)
- [Control flow](./control-flow.md) · [js](./js.md) · [Variables](./variables.md)
- [Stage condition](./stage-condition.md) · [Complete example](./complete-example.md) · [Reference](./reference.md)
`,
  )

  write('files/test/import.md', demoteH1(sliceLines(test, 48, 105), 'import'))
  write('files/test/cache.md', demoteH1(sliceLines(test, 105, 192), 'cache'))
  write(
    'files/test/stages.md',
    `# Stages and steps

${sliceLines(test, 192, 219).replace(/^### /gm, '## ')}
`,
  )
  write('files/test/call.md', demoteH1(sliceLines(test, 219, 246), 'call'))
  write('files/test/http.md', demoteH1(sliceLines(test, 246, 287), 'http'))
  write('files/test/run.md', demoteH1(sliceLines(test, 287, 414), 'run'))
  write('files/test/assert.md', demoteH1(sliceLines(test, 414, 541), 'check / assert'))
  write(
    'files/test/control-flow.md',
    `# Control flow

${sliceLines(test, 541, 636).replace(/^### /gm, '## ')}
`,
  )
  write('files/test/js.md', demoteH1(sliceLines(test, 636, 659), 'js'))
  write(
    'files/test/variables.md',
    `# Variables and data

${sliceLines(test, 659, 708).replace(/^### /gm, '## ')}
`,
  )
  write(
    'files/test/stage-condition.md',
    demoteH1(sliceLines(test, 708, 724), 'Stage condition'),
  )
  write(
    'files/test/complete-example.md',
    demoteH1(sliceLines(test, 724, 750), 'Complete example'),
  )
  write(
    'files/test/reference.md',
    demoteH1(sliceLines(test, 750, 770), 'Reference'),
  )
  write(
    'files/test.md',
    `# Test

Moved to short pages under [Test](./test/index.md).
`,
  )
}

// ---------- ENV ----------
{
  const env = read('files/env.md')
  write(
    'files/env/index.md',
    `# Environment

${sliceLines(env, 1, 5).replace(/^# Environment[^\n]*\n*/, '')}

${sliceLines(env, 5, 73)}

Next: [CLI](./cli.md) · [UI](./ui.md) · [Settings](./settings.md) · [Project root](./project-root.md) · [Reference](./reference.md)
`,
  )
  write('files/env/cli.md', demoteH1(sliceLines(env, 73, 93), 'CLI presets'))
  write(
    'files/env/ui.md',
    `# Edit in the UI

${sliceLines(env, 93, 113)}
`,
  )
  write(
    'files/env/settings.md',
    `# Settings

Certificates: see [Certificates](../../features/certificates.md).

${sliceLines(env, 117, 141)}

${sliceLines(env, 141, 153)}
`,
  )
  write(
    'files/env/project-root.md',
    demoteH1(sliceLines(env, 153, 197), 'Project root marker'),
  )
  write(
    'files/env/reference.md',
    demoteH1(sliceLines(env, 134, 141), 'Reference'),
  )
  write(
    'files/env.md',
    `# Environment\n\nMoved to [Environment](./env/index.md).\n`,
  )
}

// ---------- SUITE ----------
{
  const suite = read('files/suite.md')
  write(
    'files/suite/index.md',
    `# Suite

${sliceLines(suite, 1, 18).replace(/^# Suite[^\n]*\n*/, '')}

${sliceLines(suite, 18, 63).replace(/^## Elements\n/, '## Elements\n')}

Next: [Execution](./execution.md) · [UI](./ui.md) · [CLI](./cli.md) · [Reference](./reference.md)
`,
  )
  write(
    'files/suite/execution.md',
    `# Execution

${sliceLines(suite, 63, 124).replace(/^### /gm, '## ')}
`,
  )
  write(
    'files/suite/ui.md',
    demoteH1(sliceLines(suite, 124, 158), 'UI and execution'),
  )
  write(
    'files/suite/cli.md',
    demoteH1(sliceLines(suite, 158, 260), 'CLI'),
  )
  write(
    'files/suite/reference.md',
    demoteH1(sliceLines(suite, 260, 275), 'Reference'),
  )
  write('files/suite.md', `# Suite\n\nMoved to [Suite](./suite/index.md).\n`)
}

// ---------- DOC ----------
{
  const doc = read('files/doc.md')
  write(
    'files/doc/index.md',
    `# Doc

${sliceLines(doc, 1, 89).replace(/^# Doc[^\n]*\n*/, '')}

Next: [Try It](./try-it.md) · [Environment](./environment.md) · [Annotations](./annotations.md) · [Markdown](./markdown.md) · [Reference](./reference.md)
`,
  )
  write('files/doc/try-it.md', demoteH1(sliceLines(doc, 89, 123), 'Try It'))
  write(
    'files/doc/environment.md',
    demoteH1(sliceLines(doc, 123, 143), 'Environment variables'),
  )
  write(
    'files/doc/annotations.md',
    demoteH1(sliceLines(doc, 143, 184), 'Parameter annotations'),
  )
  write(
    'files/doc/markdown.md',
    demoteH1(sliceLines(doc, 184, 199), 'Markdown in descriptions'),
  )
  write(
    'files/doc/reference.md',
    demoteH1(sliceLines(doc, 199, 213), 'Reference'),
  )
  write('files/doc.md', `# Doc\n\nMoved to [Doc](./doc/index.md).\n`)
}

// ---------- SERVER ----------
{
  const server = read('files/server.md')
  write(
    'files/server/index.md',
    `# Mock Server

${sliceLines(server, 1, 66).replace(/^# Mock Server[^\n]*\n*/, '')}

Next: [Using](./using.md) · [TLS](./tls.md) · [Server files](./files.md) · [In tests](./in-tests.md) · [In suites](./in-suites.md)
`,
  )
  write(
    'files/server/using.md',
    `# Using the panel

${sliceLines(server, 43, 66)}
`,
  )
  write(
    'files/server/tls.md',
    demoteH1(sliceLines(server, 66, 107), 'HTTPS and mTLS'),
  )
  write(
    'files/server/files.md',
    `# Mock server files

${sliceLines(server, 107, 221).replace(/^## MMT Mock Server Files\n/, '')}
`,
  )
  write(
    'files/server/tls-files.md',
    `# TLS in server files

${sliceLines(server, 221, 271).replace(/^### /gm, '## ')}
`,
  )
  write(
    'files/server/in-tests.md',
    demoteH1(sliceLines(server, 271, 302), 'Using in tests'),
  )
  write(
    'files/server/in-suites.md',
    demoteH1(sliceLines(server, 302, 331), 'Using in suites'),
  )
  write(
    'files/server.md',
    `# Mock Server\n\nMoved to [Mock Server](./server/index.md).\n`,
  )
}

// ---------- LOADTEST ----------
{
  const lt = read('files/loadtest.md')
  write(
    'files/loadtest/index.md',
    `# Load Test

${sliceLines(lt, 1, 95).replace(/^# Load Test[^\n]*\n*/, '')}

Next: [Environment & export](./environment.md) · [Running](./running.md) · [Reports](./reports.md) · [Reference](./reference.md)
`,
  )
  write(
    'files/loadtest/environment.md',
    `# Environment and export

${sliceLines(lt, 95, 165).replace(/^### /gm, '## ')}
`,
  )
  write(
    'files/loadtest/running.md',
    `# Running

${sliceLines(lt, 165, 192)}
`,
  )
  write(
    'files/loadtest/reports.md',
    `# Reports

${sliceLines(lt, 192, 215)}
`,
  )
  write(
    'files/loadtest/reference.md',
    demoteH1(sliceLines(lt, 215, 233), 'Reference'),
  )
  write(
    'files/loadtest.md',
    `# Load Test\n\nMoved to [Load Test](./loadtest/index.md).\n`,
  )
}

// ---------- REPORT ----------
{
  const report = read('files/report.md')
  write(
    'files/report/index.md',
    `# Report

${sliceLines(report, 1, 15).replace(/^# Report[^\n]*\n*/, '')}

Formats: [JUnit](./junit.md) · [YAML](./yaml.md) · [HTML](./html.md) · [Markdown](./markdown.md)

Also: [CLI](./cli.md) · [VS Code](./vscode.md) · [CI/CD](./ci.md)
`,
  )
  write('files/report/junit.md', demoteH1(sliceLines(report, 15, 37), 'JUnit XML'))
  write(
    'files/report/yaml.md',
    demoteH1(sliceLines(report, 37, 148), 'MMT Report YAML'),
  )
  // Merge duplicate HTML sections (148-218 and 208-218)
  write(
    'files/report/html.md',
    `# HTML reports

${sliceLines(report, 148, 218)}
`,
  )
  write(
    'files/report/markdown.md',
    `# Markdown reports

${sliceLines(report, 218, 291)}
`,
  )
  write(
    'files/report/cli.md',
    `# CLI and auto-export

${sliceLines(report, 291, 364)}
`,
  )
  write(
    'files/report/vscode.md',
    demoteH1(sliceLines(report, 364, 388), 'VS Code extension'),
  )
  write(
    'files/report/ci.md',
    demoteH1(sliceLines(report, 388, 452), 'CI/CD integration'),
  )
  write(
    'files/report.md',
    `# Report\n\nMoved to [Report](./report/index.md).\n`,
  )
}

// ---------- Integration moves ----------
{
  fs.mkdirSync(path.join(docs, 'integration'), { recursive: true })
  fs.mkdirSync(path.join(docs, 'integration/convertor'), { recursive: true })

  if (fs.existsSync(path.join(docs, 'features/http-files.md'))) {
    move('features/http-files.md', 'integration/http-files.md')
  }
  if (fs.existsSync(path.join(docs, 'features/bruno-files.md'))) {
    move('features/bruno-files.md', 'integration/bruno-files.md')
  }
  if (fs.existsSync(path.join(docs, 'features/data-imports.md'))) {
    move('features/data-imports.md', 'integration/data-imports.md')
  }

  if (fs.existsSync(path.join(docs, 'features/convertor.md'))) {
    const conv = read('features/convertor.md')
    // Split roughly at "What gets generated" if present
    const genIdx = conv.search(/^## What gets generated/m)
    if (genIdx > 0) {
      write(
        'integration/convertor/index.md',
        conv.slice(0, genIdx).trim() +
          '\n\nNext: [Generated output](./generated-output.md)\n',
      )
      write(
        'integration/convertor/generated-output.md',
        demoteH1(conv.slice(genIdx), 'Generated output'),
      )
    } else {
      write('integration/convertor/index.md', conv)
    }
    rm('features/convertor.md')
  }

  // Postman note page (convertor covers it)
  write(
    'integration/postman.md',
    `# Postman

Import Postman collections with the [Convertor](./convertor/index.md).

Multimeter turns collection requests into \`type: api\` files and optional tests. Open the Convertor from the command palette or Multimeter activity bar.

See also: [Bruno files](./bruno-files.md) · [HTTP files](./http-files.md)
`,
  )

  if (fs.existsSync(path.join(docs, 'guides/testgen-profile.md'))) {
    move('guides/testgen-profile.md', 'integration/testgen-profile.md')
  }
  if (fs.existsSync(path.join(docs, 'guides/testgen-profile-ai.md'))) {
    move('guides/testgen-profile-ai.md', 'integration/testgen-profile-ai.md')
  }
}

// ---------- Features: MCP ----------
{
  if (fs.existsSync(path.join(docs, 'guides/mcp.md'))) {
    move('guides/mcp.md', 'features/mcp.md')
  }
}

// ---------- Guides retirement ----------
{
  // sample-project → get-started style short hub under docs/sample-project
  if (fs.existsSync(path.join(docs, 'guides/sample-project.md'))) {
    const sp = read('guides/sample-project.md')
    const parts = sp.split(/^## /m)
    const intro = parts[0]
    write(
      'sample-project/index.md',
      `# Sample project

${intro.replace(/^# Sample[^\n]*\n*/, '').trim()}

This walkthrough is split into short pages:

- [Environment](./environment.md)
- [APIs](./apis.md)
- [Tests](./tests.md)
- [Docs and suites](./docs-and-suites.md)
- [CLI](./cli.md)
`,
    )
    // Heuristic: write remaining ## sections as pages by title keywords
    for (const part of parts.slice(1)) {
      const nl = part.indexOf('\n')
      const title = part.slice(0, nl).trim()
      const body = part.slice(nl + 1).trim()
      const lower = title.toLowerCase()
      let dest = null
      if (lower.includes('environment') || lower.includes('env')) dest = 'sample-project/environment.md'
      else if (lower.includes('api')) dest = 'sample-project/apis.md'
      else if (lower.includes('test')) dest = 'sample-project/tests.md'
      else if (lower.includes('doc') || lower.includes('suite')) dest = 'sample-project/docs-and-suites.md'
      else if (lower.includes('cli') || lower.includes('run')) dest = 'sample-project/cli.md'
      else if (lower.includes('feature') || lower.includes('summary')) dest = 'sample-project/feature-summary.md'
      if (dest) {
        const existing = fs.existsSync(path.join(docs, dest))
          ? fs.readFileSync(path.join(docs, dest), 'utf8') + '\n\n'
          : `# ${title.replace(/^#\s*/, '')}\n\n`
        // If file already has different H1, append as ##
        if (existing.startsWith('# ') && !existing.includes(`# ${title}`)) {
          write(dest, existing.trimEnd() + `\n\n## ${title}\n\n${body}\n`)
        } else if (!existing.includes(body.slice(0, 40))) {
          write(dest, `# ${title}\n\n${body}\n`)
        }
      }
    }
    rm('guides/sample-project.md')
  }

  if (fs.existsSync(path.join(docs, 'guides/mmt-overview.md'))) {
    // Fold into files.md as short pointer; keep a slim overview under get started
    const overview = read('guides/mmt-overview.md')
    write(
      'overview.md',
      `# Multimeter overview

Short map of Multimeter concepts. Prefer task guides and the [files reference](./files.md) for details.

${overview.split(/^## /m).slice(0, 3).join('## ').replace(/^# Multimeter overview\n*/, '').slice(0, 2500)}

Continue in [Files reference](./files.md), [Quick Start](./quick-start.md), and [Sample project](./sample-project/index.md).
`,
    )
    rm('guides/mmt-overview.md')
  }

  // remove empty guides dir if empty
  const guidesDir = path.join(docs, 'guides')
  if (fs.existsSync(guidesDir) && fs.readdirSync(guidesDir).length === 0) {
    fs.rmdirSync(guidesDir)
    console.log('rmdir guides')
  }
}

// Update files.md hub
{
  let filesHub = read('files.md')
  filesHub = filesHub
    .replace(/\.\/files\/api\.md/g, './files/api/index.md')
    .replace(/\.\/files\/test\.md/g, './files/test/index.md')
    .replace(/\.\/files\/env\.md/g, './files/env/index.md')
    .replace(/\.\/files\/suite\.md/g, './files/suite/index.md')
    .replace(/\.\/files\/doc\.md/g, './files/doc/index.md')
    .replace(/\.\/files\/server\.md/g, './files/server/index.md')
    .replace(/\.\/files\/loadtest\.md/g, './files/loadtest/index.md')
    .replace(/\.\/files\/report\.md/g, './files/report/index.md')
    .replace(/features\/http-files/g, 'integration/http-files')
    .replace(/features\/bruno-files/g, 'integration/bruno-files')
    .replace(/features\/convertor/g, 'integration/convertor/index')
    .replace(/features\/data-imports/g, 'integration/data-imports')
  if (!filesHub.includes('protocols/')) {
    filesHub = filesHub.replace(
      /## Other formats[\s\S]*?(?=## |$)/,
      `## Protocols

See [Protocols](./protocols/index.md) for HTTP, WebSocket, GraphQL, and gRPC.

## Other formats

HTTP \`.http\` / Bruno / Postman live under [Integration](./integration/http-files.md).

`,
    )
  }
  write('files.md', filesHub)
}

console.log('Done.')
