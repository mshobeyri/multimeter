import fs from 'fs';
import path from 'path';

import {GUIDE_RESOURCES, readGuideContent, resolveGuidesDir} from '../resources/guides';

export type DocumentationTopic =
  'overview' | 'workflow' | 'test' | 'api' | 'loadtest' | 'suite' | 'env' | 'doc' | 'constraints' | 'all';

export type DocumentationPack = 'min' | 'full';

const FULL_TOPIC_FILES: Record<Exclude<DocumentationTopic, 'all'>, string[]> = {
  overview: ['agent-workflow.md', 'general.md', 'generate.md'],
  workflow: ['agent-workflow.md'],
  test: ['generate-test.md'],
  api: ['generate-api.md'],
  loadtest: ['generate-loadtest.md'],
  suite: ['generate-suite.md'],
  env: ['generate-env.md'],
  doc: ['generate-doc.md'],
  constraints: ['generate-test-skill.md'],
};

const MIN_TOPIC_FILES: Record<Exclude<DocumentationTopic, 'all'>, string[]> = {
  overview: ['min/overview.md'],
  workflow: ['min/workflow.md'],
  test: ['min/test.md'],
  api: ['min/api.md'],
  loadtest: ['min/loadtest.md'],
  suite: ['min/suite.md'],
  env: ['min/env.md'],
  doc: ['min/doc.md'],
  constraints: ['min/constraints.md'],
};

export function listDocumentationTopics(): Exclude<DocumentationTopic, 'all'>[] {
  return Object.keys(MIN_TOPIC_FILES) as Exclude<DocumentationTopic, 'all'>[];
}

export function readDocumentation(
    topic: DocumentationTopic = 'overview',
    pack: DocumentationPack = 'min',
): {
  topic: DocumentationTopic;
  pack: DocumentationPack;
  sections: Array<{name: string; fileName: string; content: string}>;
  usage: string;
} {
  const table = pack === 'full' ? FULL_TOPIC_FILES : MIN_TOPIC_FILES;
  const files = topic === 'all' ?
      Array.from(new Set(Object.values(table).flat())) :
      table[topic];
  const sections = files.map(fileName => {
    const resource = GUIDE_RESOURCES.find(item => item.fileName === fileName);
    return {
      name: resource?.name || fileName.replace(/\.md$/, '').replace(/^min\//, ''),
      fileName,
      content: readGuideContent(fileName),
    };
  });
  return {
    topic,
    pack,
    sections,
    usage: pack === 'min' ?
        'Default min pack. Request pack: "full" only when you need rare syntax.' :
        'Full documentation pack. Prefer pack: "min" for routine generate/modify.',
  };
}

export function resolveExamplesDir(): string {
  if (process.env.MMT_EXAMPLES_DIR && fs.existsSync(process.env.MMT_EXAMPLES_DIR)) {
    return process.env.MMT_EXAMPLES_DIR;
  }
  const bundled = path.join(__dirname, 'examples');
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  const repoExamples = path.resolve(__dirname, '..', '..', 'examples');
  if (fs.existsSync(repoExamples)) {
    return repoExamples;
  }
  return bundled;
}

export interface ExampleEntry {
  path: string;
  type: string;
  category: string;
  title?: string;
  description?: string;
}

export function loadExamplesIndex(): ExampleEntry[] {
  const examplesDir = resolveExamplesDir();
  const indexPath = path.join(examplesDir, 'examples-index.json');
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8')) as ExampleEntry[];
  }
  return [];
}

export function listExamples(options?: {
  category?: string;
  type?: string;
  includeContent?: boolean;
  maxItems?: number;
}): {
  examplesDir: string;
  examples: Array<ExampleEntry & {content?: string}>;
  patterns: Array<{
    name: string;
    description: string;
    examplePath: string;
    apiPath?: string;
    guide?: string;
  }>;
  goldenSmoke: {
    apiPath: string;
    testPath: string;
    guide: string;
    api?: string;
    test?: string;
  };
  usage: string;
} {
  const examplesDir = resolveExamplesDir();
  let examples = loadExamplesIndex();
  if (options?.category) {
    examples = examples.filter(item => item.category === options.category);
  }
  if (options?.type) {
    examples = examples.filter(item => item.type === options.type);
  }
  const maxItems = options?.maxItems ?? 50;
  examples = examples.slice(0, maxItems);

  const enriched = examples.map(entry => {
    if (!options?.includeContent) {
      return entry;
    }
    const fullPath = path.join(examplesDir, entry.path);
    const content = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : undefined;
    return {...entry, content};
  });

  const patterns = [
    {
      name: 'golden-smoke-pair',
      description:
          'REQUIRED few-shot: minimal API + scaffolded smoke test. Mirror this; call scaffold_test instead of inventing YAML.',
      examplePath: 'ai/golden_smoke/tests/echo-smoke.mmt',
      apiPath: 'ai/golden_smoke/apis/echo.mmt',
      guide: 'golden-smoke.md',
    },
    {
      name: 'api-smoke-test',
      description: 'Call one imported API, assert status, check key outputs.',
      examplePath: 'intermediate/07_simple_suite/test/echo_test.mmt',
    },
    {
      name: 'chained-api-calls',
      description: 'Login, capture outputs, reuse values in a later API call.',
      examplePath: 'intermediate/08_chained_api_calls/chained_test.mmt',
    },
    {
      name: 'data-driven-test',
      description: 'Loop over CSV rows and call an API for each row.',
      examplePath: 'intermediate/09_csv_data_driven_test/echo_csv_test.mmt',
    },
    {
      name: 'load-test',
      description: 'Run a test file with concurrency and repeat settings.',
      examplePath: 'professional/03_load_test/loadtest.mmt',
    },
  ];

  const goldenApiRel = 'ai/golden_smoke/apis/echo.mmt';
  const goldenTestRel = 'ai/golden_smoke/tests/echo-smoke.mmt';
  const goldenApiFull = path.join(examplesDir, goldenApiRel);
  const goldenTestFull = path.join(examplesDir, goldenTestRel);
  const goldenSmoke = {
    apiPath: goldenApiRel,
    testPath: goldenTestRel,
    guide: 'golden-smoke.md',
    api: fs.existsSync(goldenApiFull) ? fs.readFileSync(goldenApiFull, 'utf8') : undefined,
    test: fs.existsSync(goldenTestFull) ? fs.readFileSync(goldenTestFull, 'utf8') : undefined,
  };

  return {
    examplesDir,
    examples: enriched,
    patterns,
    goldenSmoke,
    usage: [
      'Prefer patterns[0] golden-smoke-pair / goldenSmoke as the few-shot.',
      'For new API tests call scaffold_test — do not invent YAML from scratch.',
      'Modify = patch only; never rewrite the whole file unless the user explicitly asks.',
    ].join(' '),
  };
}

/** @deprecated Prefer readDocumentation(..., 'full') */
export const TOPIC_FILES = FULL_TOPIC_FILES;
