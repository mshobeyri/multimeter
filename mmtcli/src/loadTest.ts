import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import * as JSer from 'mmt-core/dist/JSer.js';

export function loadTestFile(filePath: string): any {
  const full = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(full)) {
    throw new Error(`File not found: ${full}`);
  }
  const txt = fs.readFileSync(full, 'utf8');
  if(/(\.ya?ml|\.mmt)$/i.test(full)) {
    return yaml.load(txt);
  }
  if (/\.json$/i.test(full)) {
    return JSON.parse(txt);
  }
  try {
    return yaml.load(txt);
  } catch {
    return JSON.parse(txt);
  }
}

export function extractFlow(obj: any): { steps: any[]; stages?: any[] } {
  if (Array.isArray(obj?.stages)) {
    return { steps: [], stages: obj.stages };
  }
  if (Array.isArray(obj?.steps)) {
    return { steps: obj.steps };
  }
  return { steps: [] };
}

export function summarize(obj: any): string {
  const { steps, stages } = extractFlow(obj);
  return stages ? `stages: ${stages.length}` : `steps: ${steps.length}`;
}

export function maybeGenerateJs(obj: any): string | undefined {
  const { steps, stages } = extractFlow(obj);
  if (stages) {
    return stages.map(s =>
      `// stage: ${s.stage || s.name || 'unnamed'}\n` +
      (Array.isArray(s.steps) ? (JSer.flowStepsToJsfunc?.(s.steps as any) || '') : '')
    ).join('\n');
  }
  if (steps) {
    return JSer.flowStepsToJsfunc?.(steps as any);
  }
  return;
}
