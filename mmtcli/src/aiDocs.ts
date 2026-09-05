import fs from 'fs';
import path from 'path';

export type CliDocTopic =
  'overview'|'workflow'|'test'|'api'|'loadtest'|'suite'|'env'|'doc'|'constraints'|'all'|'offline';

export type CliDocPack = 'min'|'full';

const FULL_TOPIC_FILES: Record<Exclude<CliDocTopic, 'all'|'offline'>, string[]> = {
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

const MIN_TOPIC_FILES: Record<Exclude<CliDocTopic, 'all'|'offline'>, string[]> = {
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

export function resolveCliGuidesDir(): string {
  if (process.env.MMT_GUIDES_DIR && fs.existsSync(process.env.MMT_GUIDES_DIR)) {
    return process.env.MMT_GUIDES_DIR;
  }
  const besideCli = path.join(__dirname, 'guides');
  if (fs.existsSync(besideCli)) {
    return besideCli;
  }
  const repoGuides = path.resolve(__dirname, '..', '..', 'docs', 'AI');
  if (fs.existsSync(repoGuides)) {
    return repoGuides;
  }
  // mmtcli/dist → ../../docs/AI from repo; when installed as package:
  const pkgGuides = path.resolve(__dirname, '..', 'docs', 'AI');
  if (fs.existsSync(pkgGuides)) {
    return pkgGuides;
  }
  return besideCli;
}

function readGuide(guidesDir: string, fileName: string): string {
  const fullPath = path.join(guidesDir, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Guide not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

export function formatCliDocs(topic: CliDocTopic, pack: CliDocPack = 'min'): string {
  const guidesDir = resolveCliGuidesDir();
  if (topic === 'offline') {
    return readGuide(guidesDir, 'offline-agent.md');
  }
  const table = pack === 'full' ? FULL_TOPIC_FILES : MIN_TOPIC_FILES;
  const files = topic === 'all' ?
      Array.from(new Set(Object.values(table).flat())) :
      table[topic];
  const parts = files.map(fileName => {
    const body = readGuide(guidesDir, fileName);
    return `<!-- ${fileName} -->\n${body.trim()}\n`;
  });
  return [
    `# Multimeter docs — topic=${topic} pack=${pack}`,
    `guidesDir: ${guidesDir}`,
    '',
    ...parts,
  ].join('\n');
}

export function listCliDocTopics(): string[] {
  return [
    ...Object.keys(MIN_TOPIC_FILES),
    'all',
    'offline',
  ];
}
