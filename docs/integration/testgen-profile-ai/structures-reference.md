# Structures Reference

### API
```yaml
type: api
title: string
protocol: http | ws            # optional, inferred from URL
method: get|post|...           # HTTP only
format: json | xml | xmle | text | urlencoded | { request, response }     # affects body encoding
url: string
inputs: record<string, primitive>
body: object|string|null
examples: Array<{name: string, inputs?: record<string, primitive>}>
```

### Test
```yaml
type: test
title: string
steps: Array<call|assert|check|setenv|set|var|const|let|js|print|delay|if|for|repeat|data|run>
```

### Env
```yaml
type: env
variables: record<string, object (key-value choices) | array (allowed values)>
```

### Doc
```yaml
type: doc
title: string
sources: string[]
```
