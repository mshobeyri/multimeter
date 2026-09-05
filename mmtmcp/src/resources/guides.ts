import fs from 'fs';
import path from 'path';

export function resolveGuidesDir(): string {
  if (process.env.MMT_GUIDES_DIR && fs.existsSync(process.env.MMT_GUIDES_DIR)) {
    return process.env.MMT_GUIDES_DIR;
  }
  const bundled = path.join(__dirname, 'guides');
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  const repoGuides = path.resolve(__dirname, '..', '..', 'docs', 'AI');
  if (fs.existsSync(repoGuides)) {
    return repoGuides;
  }
  return bundled;
}

export interface GuideResource {
  uri: string;
  name: string;
  fileName: string;
}

export const GUIDE_RESOURCES: GuideResource[] = [
  {uri: 'mmt://guide/golden-smoke', name: 'golden-smoke', fileName: 'golden-smoke.md'},
  {uri: 'mmt://guide/agent-workflow', name: 'agent-workflow', fileName: 'agent-workflow.md'},
  {uri: 'mmt://guide/offline-agent', name: 'offline-agent', fileName: 'offline-agent.md'},
  {uri: 'mmt://guide/general', name: 'general', fileName: 'general.md'},
  {uri: 'mmt://guide/generate', name: 'generate', fileName: 'generate.md'},
  {uri: 'mmt://guide/generate-test', name: 'generate-test', fileName: 'generate-test.md'},
  {uri: 'mmt://guide/generate-test-skill', name: 'generate-test-skill', fileName: 'generate-test-skill.md'},
  {uri: 'mmt://guide/generate-api', name: 'generate-api', fileName: 'generate-api.md'},
  {uri: 'mmt://guide/generate-env', name: 'generate-env', fileName: 'generate-env.md'},
  {uri: 'mmt://guide/generate-suite', name: 'generate-suite', fileName: 'generate-suite.md'},
  {uri: 'mmt://guide/generate-doc', name: 'generate-doc', fileName: 'generate-doc.md'},
  {uri: 'mmt://guide/generate-loadtest', name: 'generate-loadtest', fileName: 'generate-loadtest.md'},
  {uri: 'mmt://guide/min-overview', name: 'min-overview', fileName: 'min/overview.md'},
  {uri: 'mmt://guide/min-workflow', name: 'min-workflow', fileName: 'min/workflow.md'},
  {uri: 'mmt://guide/min-test', name: 'min-test', fileName: 'min/test.md'},
  {uri: 'mmt://guide/min-api', name: 'min-api', fileName: 'min/api.md'},
  {uri: 'mmt://guide/min-suite', name: 'min-suite', fileName: 'min/suite.md'},
  {uri: 'mmt://guide/min-env', name: 'min-env', fileName: 'min/env.md'},
  {uri: 'mmt://guide/min-doc', name: 'min-doc', fileName: 'min/doc.md'},
  {uri: 'mmt://guide/min-loadtest', name: 'min-loadtest', fileName: 'min/loadtest.md'},
  {uri: 'mmt://guide/min-constraints', name: 'min-constraints', fileName: 'min/constraints.md'},
  {uri: 'mmt://profile/testgen', name: 'testgen-profile', fileName: 'testgen-profile-ai.md'},
];

export function readGuideContent(fileName: string): string {
  const guidesDir = resolveGuidesDir();
  const fullPath = path.join(guidesDir, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Guide not found: ${fileName}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

export function findGuideByUri(uri: string): GuideResource | undefined {
  return GUIDE_RESOURCES.find(item => item.uri === uri);
}
