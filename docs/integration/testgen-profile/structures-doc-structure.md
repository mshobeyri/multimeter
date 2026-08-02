# Doc structure

Aggregate and render API docs from sources.

```yaml
type: doc                    # literal
title: string
sources: string[]            # folders or .mmt files
services?: Array<{
  name?: string
  description?: string
  sources?: string[]
}>
```
