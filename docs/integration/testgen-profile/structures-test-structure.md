# Test structure

Test flows that call APIs/tests and perform checks.

```yaml
type: test                   # literal
title: string
tags: string[]
description: string
import: record<string,string>   # alias -> path (CSV or .mmt)
inputs: record<string, primitive>
outputs: record<string, primitive>
loadtest?: { threads?: number, repeat?: string|number, rampup?: string }
steps?: Step[]               # sequential when at root
stages?: Array<{            # optional staged/parallel model
  id: string
  title?: string
  condition?: string
  after?: string | string[]
  steps: Step[]
}>
```

Where a Step is one of:
- call: { call: string, id?: string, title?: string, inputs?: record<string, any>, expect?: record<string, any>, report?: 'all'|'fails'|'none' }
- check: string | ComparisonObject
- assert: string | ComparisonObject
- if: { if: string, steps: Step[], else?: Step[] }
- for: { for: string, steps: Step[] }
- repeat: { repeat: number|string, steps: Step[] }
- delay: number|string
- js: string
- print: string
- set | var | const | let: record<string, any>
- data: string
- setenv: record<string, any>
- run: string

Example:
```yaml
type: test
title: User CRUD Test
steps:
  - call: create-user
    id: create
    inputs:
      name: "John"
  - assert: ${create.status} == 201
  - check: ${create.id} != null
  - assert: ${create.name} == "John"
```

See also: docs/files/test/index.md
