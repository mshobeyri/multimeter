import type { MmtFileType } from "mmt-core/mmtFileType";

export type NotypeSampleType = MmtFileType;
export type NotypeStarterType = Exclude<NotypeSampleType, "report">;

export interface NotypeSample {
  type: NotypeSampleType;
  title: string;
  description: string;
  content: string;
}

const DOCS_BASE = "https://mmt.dev/docs";
const DEMOS_BASE = "https://mmt.dev/demos";

/** Site docs + demo-page section for each gallery file type. */
export const notypeHelpLinks: Record<NotypeSampleType, { docsUrl: string; demoUrl: string }> = {
  api: {
    docsUrl: `${DOCS_BASE}/files/api`,
    demoUrl: `${DEMOS_BASE}#api`,
  },
  env: {
    docsUrl: `${DOCS_BASE}/files/env`,
    demoUrl: `${DEMOS_BASE}#environment`,
  },
  test: {
    docsUrl: `${DOCS_BASE}/files/test`,
    demoUrl: `${DEMOS_BASE}#test`,
  },
  suite: {
    docsUrl: `${DOCS_BASE}/files/suite`,
    demoUrl: `${DEMOS_BASE}#suite`,
  },
  loadtest: {
    docsUrl: `${DOCS_BASE}/files/loadtest`,
    demoUrl: `${DEMOS_BASE}#load-test`,
  },
  doc: {
    docsUrl: `${DOCS_BASE}/files/doc`,
    demoUrl: `${DEMOS_BASE}#documentation`,
  },
  server: {
    docsUrl: `${DOCS_BASE}/files/server`,
    demoUrl: `${DEMOS_BASE}#mock-server`,
  },
  judge: {
    docsUrl: `${DOCS_BASE}/files/judge`,
    demoUrl: `${DEMOS_BASE}#judge`,
  },
  report: {
    docsUrl: `${DOCS_BASE}/files/report`,
    demoUrl: `${DEMOS_BASE}#report`,
  },
};

/** Minimal starters for the type icon row. */
export const notypeStarterByType: Record<NotypeStarterType, string> = {
  api: `type: api
url: https://test.mmt.dev
method: get
`,
  test: `type: test
steps:
  - http: https://test.mmt.dev
    expect:
      status: 200
`,
  env: `type: env
variables:
  base_url: https://test.mmt.dev
  api_key: your-api-key-here
`,
  suite: `type: suite
items:
  - path/to/first_test.mmt
  - path/to/second_test.mmt
`,
  loadtest: `type: loadtest
threads: 5
repeat: 30s
test: ./my_test.mmt
`,
  doc: `type: doc
sources:
  - api
`,
  server: `type: server
port: 9099
cors: true
endpoints:
  - method: get
    path: /hello
    status: 200
    format: json
    body:
      message: hello
`,
  judge: `type: judge
engine: ollama
model: qwen2.5-coder:7b
url: http://127.0.0.1:11434
options:
  temperature: 0
  timeout: 120s
`,
};

export function notypeStarterContent(type: NotypeSampleType): string {
  if (type in notypeStarterByType) {
    return notypeStarterByType[type as NotypeStarterType];
  }
  return `type: ${type}\n`;
}

/** Gallery cards — one step beyond the icon starters. */
export const notypeSamples: NotypeSample[] = [
  {
    type: "api",
    title: "GET with inputs",
    description: "Pass inputs into the request URL.",
    content: `type: api
inputs:
  status: 200
url: https://test.mmt.dev/status/<<i:status>>
method: get
`,
  },
  {
    type: "api",
    title: "POST with inputs and outputs",
    description: "Send dynamic body fields and extract response values.",
    content: `type: api
inputs:
  message: hello
outputs:
  echoed: body[body][message]
url: https://test.mmt.dev/echo
method: post
format: json
body:
  message: i:message
`,
  },
  {
    type: "env",
    title: "Environment with presets",
    description: "Switch variable sets with named presets.",
    content: `type: env
variables:
  base_url:
    local: http://localhost:8080
    remote: https://test.mmt.dev
  api_key: your-api-key-here
presets:
  runner:
    dev:
      base_url: local
    prod:
      base_url: remote
`,
  },
  {
    type: "test",
    title: "Status and body check",
    description: "Assert status code and a field in the JSON body.",
    content: `type: test
steps:
  - http: https://test.mmt.dev/status/200
    expect:
      status: 200
      body.status: 200
`,
  },
  {
    type: "test",
    title: "POST echo with tags",
    description: "Verify echoed JSON and tag the test for suite filters.",
    content: `type: test
tags:
  - smoke
steps:
  - http: https://test.mmt.dev/echo
    method: post
    format: json
    body:
      message: hello
    expect:
      status: 200
      body.body.message: hello
`,
  },
  {
    type: "suite",
    title: "Suite with tag filter",
    description: "Run only tests tagged smoke.",
    content: `type: suite
filter:
  only:
    - smoke
items:
  - path/to/smoke_test.mmt
  - path/to/api_test.mmt
`,
  },
  {
    type: "loadtest",
    title: "Load test with ramp-up",
    description: "Gradually increase workers before the run.",
    content: `type: loadtest
threads: 5
repeat: 30s
rampup: 2s
test: ./my_test.mmt
`,
  },
  {
    type: "doc",
    title: "Multi-source documentation",
    description: "Generate docs from API and test folders.",
    content: `type: doc
sources:
  - api
  - tests
`,
  },
  {
    type: "server",
    title: "Mock server with GET and POST",
    description: "Serve static and echo responses on one port.",
    content: `type: server
port: 9099
cors: true
endpoints:
  - method: get
    path: /hello
    status: 200
    format: json
    body:
      message: hello
  - method: post
    path: /echo
    status: 200
    format: json
    body:
      message: hello
`,
  },
  {
    type: "judge",
    title: "AI Judge with options",
    description: "Local Ollama judge with temperature and timeout.",
    content: `type: judge
engine: ollama
model: qwen2.5-coder:7b
url: http://127.0.0.1:11434
options:
  temperature: 0
  timeout: 120s
  max_tokens: 512
`,
  },
  {
    type: "report",
    title: "Test report",
    description: "Structured results view (usually generated by a run).",
    content: `type: report
kind: functional
name: example.mmt
overview:
  timestamp: "2026-01-01T00:00:00.000Z"
  duration: 1.2s
  checks: 2
  passed: 2
  failed: 0
checks:
  - name: status == 200
    type: check
    result: passed
  - name: body.message == hello
    type: check
    result: passed
`,
  },
];
