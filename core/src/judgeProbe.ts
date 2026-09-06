/**
 * Pure helpers for probing judge engines (list-models URLs, response parsing).
 * Shared by the webview probe UI and unit tests.
 */

import {AuthConfig} from './APIData';
import {buildJudgeAuth} from './judgeAuth';

export type JudgeModelInfo = {
  name: string;
  sizeLabel?: string;
  detail?: string;
  modifiedAt?: string;
};

export function formatBytes(n: number|undefined): string|undefined {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    return undefined;
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

export function normalizeEngineId(engine: string): string {
  return String(engine || '').trim().toLowerCase();
}

/**
 * Local engines are cheap to list; cloud list-models APIs are tightly
 * rate-limited (OpenAI 429 on GET /v1/models). Only auto-probe local.
 */
export function shouldAutoProbeJudge(engine: string): boolean {
  return normalizeEngineId(engine) === 'ollama';
}

/** True when a listed model corresponds to the configured `model:` value. */
export function modelMatchesConfigured(modelName: string, configured: string|undefined): boolean {
  const name = String(modelName || '').trim();
  const cfg = String(configured || '').trim();
  if (!name || !cfg) {
    return false;
  }
  if (name === cfg) {
    return true;
  }
  // Ollama tags: qwen2.5:3b vs qwen2.5
  if (name.startsWith(`${cfg}:`)) {
    return true;
  }
  // Google: models/gemini-2.0-flash
  if (name === `models/${cfg}` || name.endsWith(`/${cfg}`)) {
    return true;
  }
  return false;
}

/**
 * Build the list-models URL for a judge engine.
 * `baseUrl` is the resolved judge `url:` (no trailing slash required).
 */
export function probeUrlForEngine(engine: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const id = normalizeEngineId(engine);
  switch (id) {
    case 'ollama':
      return `${base}/api/tags`;
    case 'openai':
      return `${base}/models`;
    case 'anthropic':
      return /\/v1$/i.test(base) ? `${base}/models` : `${base}/v1/models`;
    case 'google':
      if (/\/models$/i.test(base)) {
        return `${base}?pageSize=100`;
      }
      return `${base.replace(/\/+$/, '')}/models?pageSize=100`;
    case 'azure-openai': {
      const root = base.replace(/\/openai\/?$/i, '');
      const path = `${root}/openai/models`;
      if (/[?&]api-version=/i.test(path)) {
        return path;
      }
      return path.includes('?')
          ? `${path}&api-version=2024-10-21`
          : `${path}?api-version=2024-10-21`;
    }
    default:
      return `${base}/api/tags`;
  }
}

function stripModelsPrefix(name: string): string {
  return name.startsWith('models/') ? name.slice('models/'.length) : name;
}

export function parseModels(engine: string, body: any): JudgeModelInfo[] {
  const id = normalizeEngineId(engine);

  if (id === 'openai' || id === 'azure-openai') {
    const list = Array.isArray(body?.data) ? body.data : [];
    return list
        .map((item: any) => {
          const name = String(item?.id || item?.name || '').trim();
          if (!name) {
            return null;
          }
          return {
            name,
            detail: item?.owned_by ? String(item.owned_by) : undefined,
          } as JudgeModelInfo;
        })
        .filter(Boolean) as JudgeModelInfo[];
  }

  if (id === 'anthropic') {
    const list = Array.isArray(body?.data) ? body.data : [];
    return list
        .map((item: any) => {
          const name = String(item?.id || item?.name || '').trim();
          if (!name) {
            return null;
          }
          return {
            name,
            detail: item?.display_name ? String(item.display_name) : undefined,
          } as JudgeModelInfo;
        })
        .filter(Boolean) as JudgeModelInfo[];
  }

  if (id === 'google') {
    const list = Array.isArray(body?.models) ? body.models : [];
    return list
        .map((item: any) => {
          const raw = String(item?.name || '').trim();
          if (!raw) {
            return null;
          }
          const name = stripModelsPrefix(raw);
          const methods = Array.isArray(item?.supportedGenerationMethods)
              ? item.supportedGenerationMethods.map(String)
              : [];
          const generateOk = methods.length === 0 || methods.includes('generateContent');
          if (!generateOk) {
            return null;
          }
          return {
            name,
            detail: item?.displayName ? String(item.displayName) : undefined,
          } as JudgeModelInfo;
        })
        .filter(Boolean) as JudgeModelInfo[];
  }

  // Ollama (default)
  const list = Array.isArray(body?.models) ? body.models : [];
  return list
      .map((item: any) => {
        const name = String(item?.name || item?.model || '').trim();
        if (!name) {
          return null;
        }
        const details = item?.details && typeof item.details === 'object' ? item.details : {};
        const bits = [
          details.parameter_size,
          details.quantization_level,
          details.family,
        ].filter(Boolean).map(String);
        return {
          name,
          sizeLabel: formatBytes(typeof item.size === 'number' ? item.size : undefined),
          detail: bits.length ? bits.join(' · ') : undefined,
          modifiedAt: typeof item.modified_at === 'string' ? item.modified_at : undefined,
        } as JudgeModelInfo;
      })
      .filter(Boolean) as JudgeModelInfo[];
}

/**
 * Headers for list-models probes — delegates to {@link buildJudgeAuth}.
 */
export function probeHeadersForEngine(
    engine: string,
    auth: AuthConfig|undefined|'none',
    headers: Record<string, string> = {},
    ): Record<string, string> {
  const resolved = !auth || auth === 'none' ? undefined : auth;
  return buildJudgeAuth(engine, resolved, headers).headers;
}
