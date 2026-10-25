export type FaqItem = {
  question: string
  answer: string
}

/**
 * Home / Downloads FAQ — practical questions people ask when evaluating or adopting Multimeter.
 */
export const faqItems: FaqItem[] = [
  {
    question: 'What is Multimeter?',
    answer:
      'A Git-native REST client and API test runner for VS Code (and Cursor). Requests, multi-step tests, suites, mocks, and docs are YAML .mmt files in your repo. Edit them in the visual editor; run the same files in CI with the testlight CLI. Apache 2.0, no account.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Install the Multimeter extension from the VS Code Marketplace or Open VSX (or from https://mmt.dev/downloads). Open or create a .mmt file — the editor walks you through api and test types. To try CI locally: npm i -g mmt-testlight, then npx testlight run path/to/suite.mmt. Docs: https://mmt.dev/docs/install',
  },
  {
    question: 'How is this different from Postman or Bruno?',
    answer:
      'Everything lives as reviewable YAML in Git — no cloud collection sync. Tests are declarative flows (call, expect, assert), not long Postman scripts. Suites support parallel groups and same-run call cache for login/setup, so larger suites finish faster than sequential Newman or Bruno runs. Mocks, docs, and reports stay in the same repo.',
  },
  {
    question: 'Is Multimeter free? Do I need an account?',
    answer:
      'Yes, free under Apache 2.0. No signup, no cloud workspace, no telemetry of your APIs. Install the extension and use your Git repo for sharing and access control.',
  },
  {
    question: 'What is a .mmt file?',
    answer:
      'YAML with a type field. Common types: api (one HTTP, GraphQL, gRPC, or WebSocket request), test (ordered steps: call, expect, assert, check, …), suite (run many tests/groups), env (variables and presets), server (mocks), loadtest, and judge. One format for editor and CI.',
  },
  {
    question: 'Can I bring Postman, OpenAPI, Bruno, or .http files?',
    answer:
      'Yes. Import or convert Postman collections, OpenAPI/Swagger, WSDL, Bruno (.bru), .http/.https, and curl. You can also open .http and Bruno files directly, or convert them into editable .mmt APIs and tests.',
  },
  {
    question: 'How do I run Multimeter in CI/CD?',
    answer:
      'Use the testlight CLI (npm package mmt-testlight): npx testlight run path/to/suite.mmt. Pass env with --env-file, --preset, or -e KEY=VALUE. On GitHub Actions: uses: mshobeyri/testlight-action@v1. Same approach works in GitLab CI, Jenkins, Azure Pipelines, and similar runners. Export JUnit/HTML/Markdown reports for gates and PRs.',
  },
  {
    question: 'Why are runs faster than Postman/Newman?',
    answer:
      'Suite groups and test stages can run in parallel, and login/setup steps can be cached for the rest of the same run so those HTTP calls are not repeated. On a small real Open-Meteo sample (~61 live calls) Multimeter finished in about a second while Newman took about five; larger suites with more shared setup tend to widen that gap. Details: https://mmt.dev/compare/postman',
  },
  {
    question: 'How do I use Multimeter with Cursor, Copilot, or Claude?',
    answer:
      'Prefer Multimeter MCP tools (scaffold_test, validate, format, run) so agents do not invent .mmt syntax. Cursor/Claude: npx -y mmt-mcp (see Downloads). Copilot can use the server bundled with the extension. Guide: https://mmt.dev/docs/features/mcp and https://mmt.dev/why-ai',
  },
  {
    question: 'Where do environments and secrets live?',
    answer:
      'In env .mmt files and presets in the repo, or overrides from the Environment panel and CLI flags. Keep secrets out of Git the same way you would for app config (local env files, CI secrets, ignored presets). Nothing is uploaded to a Multimeter cloud.',
  },
  {
    question: 'Does Multimeter send my API data anywhere?',
    answer:
      'No by default — runs are local or in your CI. Optional AI judge steps call only the model provider you configure (e.g. Ollama or a cloud LLM) when you add a type: judge file. MCP and the extension do not ship your collections to mmt.dev.',
  },
  {
    question: 'What about mocks, API docs, and reports?',
    answer:
      'Mocks are type: server .mmt files (HTTP/WebSocket, templates, reflect). Docs generate from the same api .mmt files (HTML or Markdown). Reports: JUnit XML, HTML, Markdown, or MMT report YAML — from the CLI (--report), the Export button, or suite export: fields.',
  },
  {
    question: 'Can Multimeter judge LLM answers like Promptfoo?',
    answer:
      'Yes. A type: judge file scores relevance, similarity, faithfulness, and factuality with a model you choose. You call it from a normal test step next to HTTP asserts — same Git files in VS Code and in CI, not a separate evaluation product.',
  },
]
