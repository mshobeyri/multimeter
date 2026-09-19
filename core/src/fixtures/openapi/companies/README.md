# Company OpenAPI fixtures

Pinned public OpenAPI/Swagger specs from large companies, used by
`openapiConvertor.companies.fixtures.test.ts`.

| File | Company | Source |
|------|---------|--------|
| `docker.openapi.yaml` | Docker | https://docs.docker.com/reference/api/engine/version/v1.51.yaml |
| `notion.openapi.yaml` | Notion | APIs.guru mirror of Notion API OpenAPI |
| `paypal.openapi.json` | PayPal | https://github.com/paypal/paypal-rest-api-specifications (Checkout Orders v2) |
| `bitbucket.openapi.json` | Atlassian Bitbucket | https://api.bitbucket.org/swagger.json |
| `box.openapi.json` | Box | https://github.com/box/box-openapi |
| `twilio.openapi.json` | Twilio | https://github.com/twilio/twilio-oai |
| `gitlab.openapi.yaml` | GitLab | GitLab OpenAPI v2 |
| `circleci.openapi.json` | CircleCI | https://circleci.com/api/v2/openapi.json |
| `slack.swagger.json` | Slack | https://github.com/slackapi/slack-api-specs |
| `digitalocean.openapi.yaml` | DigitalOcean | DigitalOcean public API v2 bundled OpenAPI |

Fixtures are committed so unit tests do not hit the network.
