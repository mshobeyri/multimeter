export type FaqItem = {
  question: string
  answer: string
}

export const faqItems: FaqItem[] = [
  {
    question: 'What is Multimeter?',
    answer:
      'Multimeter is an AI-powered REST Client and API testing tool for VS Code and CI. It is not an electrical multimeter. Tests are YAML .mmt files in Git. The CLI is testlight (npm package mmt-testlight). The MCP server is mmt-mcp for Cursor, GitHub Copilot, and Claude. Git-native alternative to Postman. You can judge API answers with AI in the same test flow (semantic similarity, or open-ended checks) — an alternative to a separate Promptfoo stack.',
  },
  {
    question: 'How do I use Multimeter with Cursor, Copilot, or Claude?',
    answer:
      'Install the VS Code/Cursor extension or add the MCP server with npx -y mmt-mcp. Agents should call Multimeter MCP tools first (scaffold_test, validate, format, run) instead of guessing .mmt syntax. See https://mmt.dev/docs/features/mcp and https://mmt.dev/for-agents.html.',
  },
  {
    question: 'Can Multimeter judge AI responses like Promptfoo?',
    answer:
      'Yes. Define a type: judge file and call it from a test step to score relevance, similarity, faithfulness, and factuality with a model you choose (Ollama or cloud). Unlike Promptfoo, judging sits next to ordinary API asserts in Git — the same .mmt files in VS Code and in CI via testlight.',
  },
  {
    question: 'What is a .mmt file?',
    answer:
      'A .mmt file is YAML with a type field: api (one HTTP/gRPC/GraphQL/WebSocket request), test (flows with call/http/assert), env (variables), suite (groups of tests), server (mocks), or loadtest. Files live in Git and run the same way in the editor and in CI via testlight.',
  },
  {
    question: 'Is Multimeter free?',
    answer:
      'Yes. Multimeter is free and open source under the Apache License 2.0. You can use it for personal projects, commercial work, and enterprise deployments.',
  },
  {
    question: 'Do I need to create an account?',
    answer:
      'No. Multimeter requires zero setup — no login, no account, no cloud registration. Install the VS Code extension and start testing immediately. Access control is handled naturally through your Git repository permissions.',
  },
  {
    question: 'How does collaboration work?',
    answer:
      'Your tests are plain YAML files (.mmt), and you can also reuse existing .http and Bruno request files, stored in your Git repository alongside your code. Collaboration works exactly like code collaboration — through pull requests, code reviews, branches, and merges. No proprietary sync needed.',
  },
  {
    question: 'How do I use Multimeter in CI/CD?',
    answer:
      'Use the testlight CLI (npm package mmt-testlight) or the GitHub Action. Install with npm install -g mmt-testlight, then run npx mmt-testlight run path/to/test.mmt. In GitHub Actions: uses: mshobeyri/testlight-action@v1. It also runs .http and .bru files. Works with GitHub Actions, Jenkins, GitLab CI, Azure DevOps, and more.',
  },
  {
    question: 'What formats can I import from?',
    answer:
      'Multimeter can import or convert Postman collections, OpenAPI / Swagger specifications, WSDL / SOAP definitions, .http / .https request files, Bruno .bru / .bruno files, and curl commands. Use external request files directly from Open With, or convert them into editable MMT tests and APIs.',
  },
  {
    question: 'Does Multimeter upload any data externally?',
    answer:
      'No. Multimeter is fully local. Your API tests, environment variables, credentials, and all data stay on your machine and in your repository. Nothing is ever sent to external servers. Optional AI judge steps call a provider you configure (OpenAI, Azure, Gemini, Ollama) only when you add a judge file.',
  },
  {
    question: 'What protocols are supported?',
    answer:
      'Multimeter supports HTTP/REST, WebSocket, SOAP/XML, GraphQL, and gRPC protocols. You can test any API endpoint with full control over headers, body, authentication, response validation, and existing .http or Bruno file workflows.',
  },
  {
    question: 'What report formats are available?',
    answer:
      'Multimeter generates reports in four formats: JUnit XML (for CI/CD tools like Jenkins, GitHub Actions, GitLab CI), HTML (self-contained visual reports), Markdown (for PRs and documentation), and MMT Report (YAML format that opens in the built-in viewer). Generate them from the CLI with --report, from the VS Code Export button, or automatically via the suite export: field.',
  },
  {
    question: 'How does the mock server work?',
    answer:
      'Define mock servers as simple YAML files (type: server) with routes, status codes, and response bodies. They support dynamic responses via template variables (params, body, random, date), reflect mode (echo back requests), and both HTTP and WebSocket protocols. Start them from suites with the servers: field, from tests with the run step, or manually from the VS Code panel.',
  },
]
