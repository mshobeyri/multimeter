import {normalizeEngineId} from './judgeProbeHelpers';

/** Canonical default base URL for each judge engine. */
export function defaultUrlForEngine(engine: string): string {
  switch (normalizeEngineId(engine)) {
    case 'ollama':
      return 'http://127.0.0.1:11434';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'anthropic':
      return 'https://api.anthropic.com';
    case 'google':
      return 'https://generativelanguage.googleapis.com/v1beta';
    case 'azure-openai':
      return 'https://YOUR_RESOURCE.openai.azure.com';
    default:
      return '';
  }
}

export function normalizeJudgeUrl(url: string|undefined): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function isDefaultJudgeUrl(engine: string, url: string|undefined): boolean {
  const def = normalizeJudgeUrl(defaultUrlForEngine(engine));
  if (!def) {
    return false;
  }
  return normalizeJudgeUrl(url) === def;
}
