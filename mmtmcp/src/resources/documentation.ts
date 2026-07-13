import fs from 'fs';
import path from 'path';

import {GUIDE_RESOURCES, readGuideContent, resolveGuidesDir} from '../resources/guides';

export type DocumentationTopic =
  'overview' | 'workflow' | 'test' | 'api' | 'loadtest' | 'suite' | 'env' | 'doc' | 'constraints' | 'all';

const TOPIC_FILES: Record<Exclude<DocumentationTopic, 'all'>, string[]> = {
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

export function readDocumentation(topic: DocumentationTopic = 'overview'): {
  topic: DocumentationTopic;
  sections: Array<{name: string; fileName: string; content: string}>;
} {
  const files = topic === 'all' ?
      Array.from(new Set(Object.values(TOPIC_FILES).flat())) :
      TOPIC_FILES[topic];
  const sections = files.map(fileName => {
    const resource = GUIDE_RESOURCES.find(item => item.fileName === fileName);
    return {
      name: resource?.name || fileName.replace(/\.md$/, ''),
      fileName,
      content: readGuideContent(fileName),
    };
  });
  return {topic, sections};
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
  patterns: Array<{name: string; description: string; examplePath: string}>;
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

  return {
    examplesDir,
    examples: enriched,
    patterns,
  };
}

export function resolveGuidesRoot(): string {
  return resolveGuidesDir();
}
