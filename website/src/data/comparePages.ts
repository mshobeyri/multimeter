export interface CompareRow {
  feature: string
  other: string
  multimeter: string
}

export interface ComparePageData {
  slug: string
  name: string
  title: string
  description: string
  intro: string
  switchReasons: string[]
  rows: CompareRow[]
}

export const comparePages: ComparePageData[] = [
  {
    slug: 'postman',
    name: 'Postman',
    title: 'Multimeter vs Postman — Git-native API testing in VS Code',
    description:
      'Compare Multimeter and Postman. Keep API tests in Git, run them in VS Code and CI, with no cloud account or collection lock-in.',
    intro:
      'Postman is the default API client for many teams. It is powerful, and it is also a cloud product: collections, environments, and monitors live on their platform. Multimeter is a VS Code extension and CLI. Requests, tests, mocks, and docs are YAML files in your repo — the same files locally and in CI.',
    switchReasons: [
      'No Postman account, workspace, or cloud sync',
      'Tests are reviewable in pull requests like application code',
      'Local runs and CI use the same .mmt files via testlight',
      'Mocks, suites, and generated docs stay in Git instead of a separate product',
    ],
    rows: [
      { feature: 'Price', other: 'Freemium / per-user plans', multimeter: 'Free (Apache 2.0)' },
      { feature: 'Where it runs', other: 'Standalone app + cloud', multimeter: 'VS Code + CLI' },
      { feature: 'Storage', other: 'Cloud collections (JSON export)', multimeter: 'Git-native YAML (.mmt)' },
      { feature: 'CI', other: 'Newman + extra setup', multimeter: 'testlight / GitHub Action' },
      { feature: 'Mock server', other: 'Cloud (paid)', multimeter: 'Built-in, local YAML' },
      { feature: 'API docs', other: 'Limited / paid', multimeter: 'HTML and Markdown from the same files' },
      { feature: 'Load testing', other: 'Limited', multimeter: 'Built-in (beta)' },
      { feature: 'Offline', other: 'No (cloud-first)', multimeter: 'Yes' },
    ],
  },
  {
    slug: 'bruno',
    name: 'Bruno',
    title: 'Multimeter vs Bruno — Git-native API testing without leaving VS Code',
    description:
      'Compare Multimeter and Bruno. Both keep API work in Git. Multimeter adds test flows, suites, mocks, docs, reports, and a VS Code editor.',
    intro:
      'Bruno proved that API collections belong in Git, not in a cloud workspace. Multimeter keeps that model and extends it: you still start with a single request, then add tests, suites, mock servers, generated docs, and CI reports without switching tools. Editing happens in VS Code, not a separate desktop app.',
    switchReasons: [
      'Stay in VS Code instead of a second API app',
      'Multi-step tests, suites, and parallel groups without scripting everything',
      'Built-in mock server, HTML/Markdown docs, and JUnit/HTML reports',
      'Open .http and .bru files, or convert them to .mmt when you need flows',
    ],
    rows: [
      { feature: 'Price', other: 'Free core / paid extras', multimeter: 'Free (Apache 2.0)' },
      { feature: 'Where it runs', other: 'Standalone app', multimeter: 'VS Code + CLI' },
      { feature: 'Storage', other: 'Git-native .bru files', multimeter: 'Git-native YAML (.mmt)' },
      { feature: 'Test orchestration', other: 'Sequential runner', multimeter: 'Steps, stages, suites, parallel groups' },
      { feature: 'Mock server', other: 'No', multimeter: 'Built-in' },
      { feature: 'Generated API docs', other: 'No', multimeter: 'HTML and Markdown' },
      { feature: 'CI reports', other: 'Limited', multimeter: 'JUnit, HTML, Markdown, MMT' },
      { feature: 'gRPC', other: 'No', multimeter: 'Yes' },
    ],
  },
  {
    slug: 'thunder-client',
    name: 'Thunder Client',
    title: 'Multimeter vs Thunder Client — VS Code API testing that grows into CI',
    description:
      'Compare Multimeter and Thunder Client. Both run inside VS Code. Multimeter stores tests as Git-friendly YAML and runs the same files in CI with testlight.',
    intro:
      'Thunder Client is a popular VS Code REST client: send a request, see the response, stay in the editor. Multimeter starts there too, then uses the same files for automated tests, suites, mocks, documentation, and CI. You do not outgrow a GUI collection that cannot run the same way in GitHub Actions.',
    switchReasons: [
      'Plain YAML in the repo instead of a VS Code-only collection store',
      'The same file runs in the editor and in CI (testlight / GitHub Action)',
      'Tests, mocks, and docs are part of the same format',
      'Import curl, Postman, OpenAPI, .http, and Bruno when you switch',
    ],
    rows: [
      { feature: 'Price', other: 'Free / paid plans', multimeter: 'Free (Apache 2.0)' },
      { feature: 'Where it runs', other: 'VS Code', multimeter: 'VS Code + CLI' },
      { feature: 'Storage', other: 'Extension collection / Git (paid tiers)', multimeter: 'Git-native YAML (.mmt)' },
      { feature: 'CI', other: 'Not the same local runner', multimeter: 'testlight / GitHub Action' },
      { feature: 'Suites and flows', other: 'Limited', multimeter: 'Tests, suites, parallel groups' },
      { feature: 'Mock server', other: 'No', multimeter: 'Built-in' },
      { feature: 'Protocols', other: 'HTTP-focused', multimeter: 'HTTP, WebSocket, GraphQL, gRPC' },
      { feature: 'Reports', other: 'Limited', multimeter: 'JUnit, HTML, Markdown' },
    ],
  },
  {
    slug: 'rest-client',
    name: 'REST Client',
    title: 'Multimeter vs REST Client — from .http files to tests, mocks, and CI',
    description:
      'Compare Multimeter and the REST Client VS Code extension. Multimeter opens .http files and adds YAML tests, suites, mocks, docs, and a CLI for CI.',
    intro:
      'REST Client (Humao) made .http files the simplest way to send a request from VS Code. Multimeter can open those files. When you need environments, multi-step tests, mocks, generated docs, or a pipeline, you grow into .mmt without abandoning the editor or inventing a second toolchain.',
    switchReasons: [
      'Keep sending requests from VS Code, including existing .http files',
      'Promote a request into a test, suite, or mock without leaving Git',
      'Run the same definitions in CI with testlight',
      'GraphQL, gRPC, WebSocket, and reports when .http is no longer enough',
    ],
    rows: [
      { feature: 'Price', other: 'Free', multimeter: 'Free (Apache 2.0)' },
      { feature: 'Where it runs', other: 'VS Code', multimeter: 'VS Code + CLI' },
      { feature: 'Storage', other: '.http / .rest files', multimeter: '.mmt YAML, plus .http support' },
      { feature: 'CI', other: 'No first-class runner', multimeter: 'testlight / GitHub Action' },
      { feature: 'Assertions', other: 'Minimal', multimeter: 'assert, check, 12+ operators' },
      { feature: 'Mock server', other: 'No', multimeter: 'Built-in' },
      { feature: 'Suites', other: 'No', multimeter: 'Yes' },
      { feature: 'Generated docs', other: 'No', multimeter: 'HTML and Markdown' },
    ],
  },
]

export function comparePageBySlug(slug: string | undefined): ComparePageData | undefined {
  if (!slug) {
    return undefined
  }
  return comparePages.find((page) => page.slug === slug)
}
