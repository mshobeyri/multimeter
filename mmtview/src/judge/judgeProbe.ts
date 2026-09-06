import {AuthConfig} from 'mmt-core/APIData';
import {appendQuery, buildJudgeAuth} from 'mmt-core/judgeAuth';
import {resolveEnvTokenValues} from 'mmt-core/variableReplacer';
import {NetworkNodeApi} from '../components/network/NetworkNodeApi';
import {
  JudgeModelInfo,
  modelMatchesConfigured,
  parseModels,
  probeUrlForEngine,
} from './judgeProbeHelpers';

export type {JudgeModelInfo} from './judgeProbeHelpers';
export {
  formatBytes,
  modelMatchesConfigured,
  parseModels,
  probeHeadersForEngine,
  probeUrlForEngine,
} from './judgeProbeHelpers';

export type JudgeProbeResult = {
  state: 'idle'|'loading'|'ok'|'error';
  message?: string;
  models: JudgeModelInfo[];
  configuredModelPresent?: boolean;
  durationMs?: number;
};

function resolveAuthForProbe(
    auth: AuthConfig|undefined,
    envParams: Record<string, any>,
    ): AuthConfig|undefined {
  if (!auth || auth === 'none') {
    return auth;
  }
  if (auth.type === 'bearer') {
    return {
      type: 'bearer',
      token: String(resolveEnvTokenValues(auth.token || '', envParams) || auth.token || ''),
    };
  }
  if (auth.type === 'basic') {
    return {
      type: 'basic',
      username: String(resolveEnvTokenValues(auth.username || '', envParams) || auth.username || ''),
      password: String(resolveEnvTokenValues(auth.password || '', envParams) || auth.password || ''),
    };
  }
  if (auth.type === 'api-key') {
    return {
      type: 'api-key',
      header: auth.header,
      query: auth.query,
      value: String(resolveEnvTokenValues(auth.value || '', envParams) || auth.value || ''),
    };
  }
  return auth;
}

/**
 * Probe judge engine connectivity and list models when the engine supports it.
 * Uses the extension network bridge (not webview fetch) so localhost Ollama works.
 */
export function probeJudgeConnection(args: {
  engine: string;
  url: string;
  model?: string;
  auth?: AuthConfig;
  envParams?: Record<string, any>;
  timeoutMs?: number;
  onResult: (result: JudgeProbeResult) => void;
}): string | undefined {
  const envParams = args.envParams || {};
  const rawUrl = String(args.url || '').trim();
  const resolvedUrl = String(resolveEnvTokenValues(rawUrl, envParams) || rawUrl).trim();
  if (!resolvedUrl) {
    args.onResult({
      state: 'error',
      message: 'URL is empty',
      models: [],
    });
    return undefined;
  }

  const auth = resolveAuthForProbe(args.auth, envParams);
  const built = buildJudgeAuth(args.engine, auth, {});
  const url = appendQuery(probeUrlForEngine(args.engine, resolvedUrl), built.query);
  const started = Date.now();

  args.onResult({state: 'loading', models: []});

  return NetworkNodeApi.sendHttp({
    url,
    method: 'GET',
    timeout: args.timeoutMs ?? 8000,
    headers: built.headers,
    onResponse: (res) => {
      const durationMs = Date.now() - started;
      const status = typeof res?.status === 'number' ? res.status : -1;
      if (status < 0 || status >= 400) {
        args.onResult({
          state: 'error',
          message: res?.statusText
              ? `HTTP ${status} ${res.statusText}`
              : `HTTP ${status}`,
          models: [],
          durationMs,
        });
        return;
      }
      let body = res?.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      const models = parseModels(args.engine, body);
      const configured = String(args.model || '').trim();
      const configuredModelPresent = configured
          ? models.some(m => modelMatchesConfigured(m.name, configured))
          : undefined;
      args.onResult({
        state: 'ok',
        message: models.length
            ? `${models.length} model${models.length === 1 ? '' : 's'} available`
            : 'Reachable',
        models,
        configuredModelPresent,
        durationMs,
      });
    },
    onError: (err) => {
      args.onResult({
        state: 'error',
        message: err?.message || 'Connection failed',
        models: [],
        durationMs: Date.now() - started,
      });
    },
  });
}
