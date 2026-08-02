# Skeletons (for Scaffolding)

- api: `type: api\ntitle: ${TITLE}\nprotocol: http\nmethod: get\nurl: <<e:api_url>>/${API_NAME}\ninputs: {}\n`
- test: `type: test\ntitle: ${TITLE}\nsteps:\n  - call: ${API_NAME}\n  - assert: status == 200\n`
- env: `type: env\nvariables:\n  api_url:\n    local: http://localhost:8080\n    prod: https://test.mmt.dev\n`
- doc: `type: doc\ntitle: ${TITLE}\nsources:\n  - ./apis\n`
