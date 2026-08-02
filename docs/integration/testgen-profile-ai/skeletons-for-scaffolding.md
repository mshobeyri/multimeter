# Skeletons (for Scaffolding)

- `api:` `type: api\ntitle: ${title}\nprotocol: http\nmethod: get\nurl: <<e:api_url>>/${api_name}\ninputs: {}\n`
- `test:` `type: test\ntitle: ${title}\nsteps:\n  - call: ${api_name}\n  - assert: status == 200\n`
- `env:` `type: env\nvariables:\n  api_url:\n    local: http://localhost:8080\n    prod: https://test.mmt.dev\n`
- `doc:` `type: doc\ntitle: ${title}\nsources:\n  - ./apis\n`
