# Company Postman fixtures

Pinned Postman Collection v2.1 JSON from large companies, used by
`postmanConvertor.companies.fixtures.test.ts`.

| File | Company | Provenance |
|------|---------|------------|
| `stripe.postman_collection.json` | Stripe | Official `stripe/stripe-postman` (trimmed to 60 requests) |
| `paypal.postman_collection.json` | PayPal | Official `paypal/postman-collections` Public APIs (trimmed) |
| `twitter.postman_collection.json` | X (Twitter) | Official `twitterdev/postman-twitter-api` |
| `braintree.postman_collection.json` | Braintree (PayPal) | Official `paypal/integration-packs` |
| `docker.postman_collection.json` | Docker | Generated via `openapi-to-postmanv2` from Docker Engine OpenAPI (trimmed) |
| `notion.postman_collection.json` | Notion | Generated from Notion OpenAPI |
| `bitbucket.postman_collection.json` | Atlassian Bitbucket | Generated from Bitbucket swagger.json (trimmed) |
| `box.postman_collection.json` | Box | Generated from Box Platform OpenAPI (trimmed) |
| `twilio.postman_collection.json` | Twilio | Generated from Twilio OAI (trimmed) |
| `slack.postman_collection.json` | Slack | Generated from Slack Web API Swagger (trimmed) |

Large official collections are trimmed to 60 leaf requests so the repo and CI stay light; request shapes remain real company payloads.
