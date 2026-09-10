import fs from 'fs';
import path from 'path';

import * as agentDocs from 'mmt-core/agentDocs';

export type CliDocTopic = agentDocs.AgentDocTopic;
export type CliDocPack = agentDocs.AgentDocPack;

export function resolveCliGuidesDir(): string {
  if (process.env.MMT_GUIDES_DIR && fs.existsSync(process.env.MMT_GUIDES_DIR)) {
    return process.env.MMT_GUIDES_DIR;
  }
  const candidates = [
    path.join(__dirname, 'guides'),
    path.resolve(__dirname, '..', '..', 'docs', 'AI'),
    path.resolve(__dirname, '..', 'docs', 'AI'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

function readGuide(guidesDir: string, fileName: string): string {
  const fullPath = path.join(guidesDir, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Guide not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

export function formatCliDocs(
    topic: CliDocTopic, pack: CliDocPack = 'min'): string {
  const guidesDir = resolveCliGuidesDir();
  return agentDocs.formatAgentDocs({
    topic,
    pack,
    guidesDir,
    readText: (fileName) => readGuide(guidesDir, fileName),
  });
}

export function listCliDocTopics(): string[] {
  return agentDocs.listAgentDocTopics();
}
