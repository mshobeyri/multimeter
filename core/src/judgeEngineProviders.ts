import {JudgeData, JudgeRequest, JudgeResult} from './JudgeData';
import {appendQuery, buildJudgeAuth, resolveJudgeBaseUrl} from './judgeAuth';
import {
  JudgeEngine,
  JudgeHttpPost,
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
  parseJudgeModelJson,
  registerJudgeEngine,
  resolveJudgeHttpPost,
  resolveJudgeTimeoutMs,
} from './judgeEngine';

export function extractJudgeHttpErrorMessage(body: unknown): string {
  let parsed = body;
  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if (!trimmed) {
      return '';
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return '';
  }
  const rec = parsed as Record<string, any>;
  const msg = rec.error?.message || rec.message;
  return typeof msg === 'string' ? msg.trim() : '';
}

export function formatJudgeHttpError(
    label: string,
    res: {status: number; statusText?: string; body?: unknown},
    ): string {
  const head = `${label} HTTP ${res.status} ${res.statusText || ''}`.trim();
  const fromBody = extractJudgeHttpErrorMessage(res.body);
  return fromBody ? `${head}: ${fromBody}` : head;
}

function failResult(req: JudgeRequest, details: string, raw?: unknown): JudgeResult {
  return {
    passed: false,
    checks: Object.keys(req.checks || {}).map(name => ({
      name, passed: false, details,
    })),
    criteria: (req.criteria || []).map((text, index) => ({
      index, text, passed: false, reason: details,
    })),
    raw,
  };
}

function temperatureOf(judge: JudgeData): number {
  return typeof judge.options?.temperature === 'number' ? judge.options.temperature : 0;
}

async function postJson(
    req: JudgeRequest,
    httpPost: JudgeHttpPost|undefined,
    url: string,
    headers: Record<string, string>,
    body: unknown,
    label: string,
    ): Promise<{ok: true; body: any}|{ok: false; result: JudgeResult}> {
  const post = resolveJudgeHttpPost(httpPost);
  const timeoutMs = resolveJudgeTimeoutMs(req.judge) ?? 60_000;
  let res: {status: number; statusText: string; body: any};
  try {
    res = await post({url, headers, body, timeoutMs});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {ok: false, result: failResult(req, `${label} request failed: ${msg}`)};
  }
  if (res.status < 200 || res.status >= 300) {
    const details = formatJudgeHttpError(label, res);
    return {ok: false, result: failResult(req, details, res.body)};
  }
  return {ok: true, body: res.body};
}

function extractOpenAiContent(body: any): string {
  if (body == null) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
        .map((part: any) => typeof part?.text === 'string' ? part.text : '')
        .join('');
  }
  return JSON.stringify(body);
}

function extractAnthropicContent(body: any): string {
  if (body == null) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  const blocks = Array.isArray(body?.content) ? body.content : [];
  const texts = blocks
      .filter((b: any) => b && (b.type === 'text' || typeof b.text === 'string'))
      .map((b: any) => String(b.text || ''));
  if (texts.length > 0) {
    return texts.join('');
  }
  return JSON.stringify(body);
}

function extractGoogleContent(body: any): string {
  if (body == null) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  const parts = body?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((p: any) => String(p?.text || '')).join('');
  }
  return JSON.stringify(body);
}

function openAiChatUrl(base: string): string {
  if (/\/chat\/completions$/i.test(base)) {
    return base;
  }
  return `${base}/chat/completions`;
}

function azureChatUrl(judge: JudgeData): string {
  const base = resolveJudgeBaseUrl(judge.url);
  if (/\/chat\/completions/i.test(base)) {
    if (/[?&]api-version=/i.test(base)) {
      return base;
    }
    return base.includes('?')
        ? `${base}&api-version=2024-10-21`
        : `${base}?api-version=2024-10-21`;
  }
  const root = base.replace(/\/openai\/?$/i, '');
  const model = encodeURIComponent(String(judge.model || '').trim());
  const path = `${root}/openai/deployments/${model}/chat/completions`;
  if (/[?&]api-version=/i.test(path)) {
    return path;
  }
  return `${path}?api-version=2024-10-21`;
}

function anthropicMessagesUrl(base: string): string {
  if (/\/messages$/i.test(base)) {
    return base;
  }
  if (/\/v1$/i.test(base)) {
    return `${base}/messages`;
  }
  return `${base}/v1/messages`;
}

function googleGenerateUrl(base: string, model: string): string {
  const cleaned = model.startsWith('models/') ? model.slice('models/'.length) : model;
  const encoded = encodeURIComponent(cleaned);
  if (/\/models$/i.test(base)) {
    return `${base}/${encoded}:generateContent`;
  }
  if (/:generateContent$/i.test(base)) {
    return base;
  }
  return `${base}/models/${encoded}:generateContent`;
}

async function evaluateOpenAiCompatible(
    req: JudgeRequest,
    httpPost: JudgeHttpPost|undefined,
    url: string,
    engineId: string,
    label: string,
    opts?: {omitModel?: boolean},
    ): Promise<JudgeResult> {
  const auth = buildJudgeAuth(engineId, req.judge.auth);
  const finalUrl = appendQuery(url, auth.query);
  const body: Record<string, unknown> = {
    temperature: temperatureOf(req.judge),
    response_format: {type: 'json_object'},
    messages: [
      {role: 'system', content: buildJudgeSystemPrompt()},
      {role: 'user', content: buildJudgeUserPrompt(req)},
    ],
  };
  if (!opts?.omitModel) {
    body.model = req.judge.model;
  }
  const posted = await postJson(req, httpPost, finalUrl, auth.headers, body, label);
  if (!posted.ok) {
    return posted.result;
  }
  return parseJudgeModelJson(extractOpenAiContent(posted.body), req);
}

export const openaiJudgeEngine: JudgeEngine = {
  id: 'openai',

  validate(judge) {
    const errors: string[] = [];
    if (!String(judge.url ?? '').trim()) {
      errors.push('url is required');
    }
    if (!String(judge.model ?? '').trim()) {
      errors.push('model is required');
    }
    return errors;
  },

  async evaluate(req, httpPost) {
    const url = openAiChatUrl(resolveJudgeBaseUrl(req.judge.url));
    return evaluateOpenAiCompatible(req, httpPost, url, 'openai', 'OpenAI');
  },
};

export const azureOpenAiJudgeEngine: JudgeEngine = {
  id: 'azure-openai',

  validate(judge) {
    const errors: string[] = [];
    if (!String(judge.url ?? '').trim()) {
      errors.push('url is required');
    }
    if (!String(judge.model ?? '').trim()) {
      errors.push('model (deployment name) is required');
    }
    return errors;
  },

  async evaluate(req, httpPost) {
    const url = azureChatUrl(req.judge);
    return evaluateOpenAiCompatible(
        req, httpPost, url, 'azure-openai', 'Azure OpenAI', {omitModel: true});
  },
};

export const anthropicJudgeEngine: JudgeEngine = {
  id: 'anthropic',

  validate(judge) {
    const errors: string[] = [];
    if (!String(judge.url ?? '').trim()) {
      errors.push('url is required');
    }
    if (!String(judge.model ?? '').trim()) {
      errors.push('model is required');
    }
    return errors;
  },

  async evaluate(req, httpPost) {
    const auth = buildJudgeAuth('anthropic', req.judge.auth);
    const url = appendQuery(
        anthropicMessagesUrl(resolveJudgeBaseUrl(req.judge.url)),
        auth.query);
    const body = {
      model: req.judge.model,
      max_tokens: 4096,
      temperature: temperatureOf(req.judge),
      system: buildJudgeSystemPrompt(),
      messages: [
        {role: 'user', content: buildJudgeUserPrompt(req)},
      ],
    };
    const posted = await postJson(req, httpPost, url, auth.headers, body, 'Anthropic');
    if (!posted.ok) {
      return posted.result;
    }
    return parseJudgeModelJson(extractAnthropicContent(posted.body), req);
  },
};

export const googleJudgeEngine: JudgeEngine = {
  id: 'google',

  validate(judge) {
    const errors: string[] = [];
    if (!String(judge.url ?? '').trim()) {
      errors.push('url is required');
    }
    if (!String(judge.model ?? '').trim()) {
      errors.push('model is required');
    }
    return errors;
  },

  async evaluate(req, httpPost) {
    const auth = buildJudgeAuth('google', req.judge.auth);
    const url = appendQuery(
        googleGenerateUrl(resolveJudgeBaseUrl(req.judge.url), String(req.judge.model || '')),
        auth.query);
    const body = {
      systemInstruction: {
        parts: [{text: buildJudgeSystemPrompt()}],
      },
      contents: [
        {
          role: 'user',
          parts: [{text: buildJudgeUserPrompt(req)}],
        },
      ],
      generationConfig: {
        temperature: temperatureOf(req.judge),
        responseMimeType: 'application/json',
      },
    };
    const posted = await postJson(req, httpPost, url, auth.headers, body, 'Google');
    if (!posted.ok) {
      return posted.result;
    }
    return parseJudgeModelJson(extractGoogleContent(posted.body), req);
  },
};

registerJudgeEngine(openaiJudgeEngine);
registerJudgeEngine(azureOpenAiJudgeEngine);
registerJudgeEngine(anthropicJudgeEngine);
registerJudgeEngine(googleJudgeEngine);
