import {JudgeData, JudgeRequest, JudgeResult} from './JudgeData';
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

function resolveBaseUrl(judge: JudgeData): string {
  return String(judge.url || '').replace(/\/+$/, '');
}

export const ollamaJudgeEngine: JudgeEngine = {
  id: 'ollama',

  validate(judge) {
    const errors: string[] = [];
    if (!String(judge.url ?? '').trim()) {
      errors.push('url is required');
    } else if (typeof judge.url !== 'string') {
      errors.push('url must be a string');
    }
    return errors;
  },

  async evaluate(req: JudgeRequest, httpPost?: JudgeHttpPost): Promise<JudgeResult> {
    const post = resolveJudgeHttpPost(httpPost);
    const baseUrl = resolveBaseUrl(req.judge);
    const url = `${baseUrl}/api/chat`;
    const temperature = typeof req.judge.options?.temperature === 'number' ?
        req.judge.options.temperature :
        0;
    const timeoutMs = resolveJudgeTimeoutMs(req.judge) ?? 60_000;

    const body = {
      model: req.judge.model,
      stream: false,
      format: 'json',
      options: {temperature},
      messages: [
        {role: 'system', content: buildJudgeSystemPrompt()},
        {role: 'user', content: buildJudgeUserPrompt(req)},
      ],
    };

    let res: {status: number; statusText: string; body: any};
    try {
      res = await post({
        url,
        headers: {'Content-Type': 'application/json'},
        body,
        timeoutMs,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        passed: false,
        checks: Object.keys(req.checks || {}).map(name => ({
          name,
          passed: false,
          details: `Ollama request failed: ${msg}`,
        })),
        criteria: (req.criteria || []).map((text, index) => ({
          index,
          text,
          passed: false,
          reason: `Ollama request failed: ${msg}`,
        })),
      };
    }

    if (res.status < 200 || res.status >= 300) {
      const details = `Ollama HTTP ${res.status} ${res.statusText || ''}`.trim();
      return {
        passed: false,
        checks: Object.keys(req.checks || {}).map(name => ({
          name, passed: false, details,
        })),
        criteria: (req.criteria || []).map((text, index) => ({
          index, text, passed: false, reason: details,
        })),
        raw: res.body,
      };
    }

    const content = extractOllamaContent(res.body);
    return parseJudgeModelJson(content, req);
  },
};

function extractOllamaContent(body: any): string {
  if (body == null) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  const messageContent = body?.message?.content;
  if (typeof messageContent === 'string') {
    return messageContent;
  }
  if (typeof body?.response === 'string') {
    return body.response;
  }
  return JSON.stringify(body);
}

registerJudgeEngine(ollamaJudgeEngine);
