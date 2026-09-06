import {
  mergeJudgeStepConfig,
  normalizeJudgeCheckValue,
  unionJudgeChecksForModel,
} from './JudgeData';
import {
  buildJudgeSystemPrompt,
  evaluateJudge,
  parseJudgeModelJson,
  registerJudgeEngine,
} from './judgeEngine';
import {JUDGE_BUILTIN_CHECK_IDS} from './judgeChecks';
import './judgeEngineOllama';
import './judgeEngineProviders';
import {objectToJudge, validateJudgeObject, yamlToJudgeStrict} from './judgeParsePack';
import {fileType} from './JSerHelper';
import {setFileLoader} from './JSerFileLoader';
import {importsToJsfunc} from './JSerImports';
import {getTestFlowStepType, yamlToTestStrict} from './testParsePack';
import {flowStepsToJsfunc} from './JSerTestFlow';
import {judge_, isAssertionFailedError} from './testHelper';

describe('judge parse pack', () => {
  it('parses ollama judge yaml', () => {
    const yaml = `
type: judge
title: Local
engine: ollama
model: qwen3:4b
url: e:ollama_url
options:
  temperature: 0
  timeout: 30s
defaults:
  checks:
    semanticSimilarity: 0.8
`;
    const j = yamlToJudgeStrict(yaml);
    expect(j.type).toBe('judge');
    expect(j.engine).toBe('ollama');
    expect(j.model).toBe('qwen3:4b');
    expect(j.url).toBe('e:ollama_url');
    expect(fileType('x.mmt', yaml)).toBe('judge');
  });

  it('parses openai-style auth', () => {
    const yaml = `
type: judge
engine: openai
model: gpt-4o-mini
url: https://api.openai.com/v1
auth:
  type: bearer
  token: e:openai_api_key
`;
    const j = yamlToJudgeStrict(yaml);
    expect(j.url).toBe('https://api.openai.com/v1');
    expect(j.auth).toEqual({type: 'bearer', token: 'e:openai_api_key'});
  });

  it('fileType stays judge when auth is type: api-key', () => {
    const yaml = `
type: judge
engine: google
model: gemini-2.5-flash
url: https://generativelanguage.googleapis.com/v1beta
auth:
  type: api-key
  header: x-goog-api-key
  value: e:api_key
`;
    expect(fileType('google.mmt', yaml)).toBe('judge');
  });

  it('imports a judge file that uses auth type: api-key', async () => {
    const yaml = `
type: judge
engine: google
model: gemini-2.5-flash
url: https://generativelanguage.googleapis.com/v1beta
auth:
  type: api-key
  header: x-goog-api-key
  value: e:api_key
`;
    setFileLoader(async (p: string) => {
      if (p.endsWith('google.mmt')) {
        return yaml;
      }
      return '';
    });
    const js = await importsToJsfunc(
        {localJudge: './judges/google.mmt'}, undefined, '/root/judge_demo.mmt');
    expect(js).toContain('google');
    expect(js).toMatch(/api-key|x-goog-api-key/);
  });

  it('rejects missing engine/model/url', () => {
    expect(validateJudgeObject({type: 'judge'})).toEqual(
        expect.arrayContaining([
          'engine is required',
          'model is required',
          'url is required',
        ]));
  });
});

describe('judge step parse', () => {
  it('parses judge with context/expect/require', () => {
    const yaml = `
type: test
import:
  localJudge: ./judges/local.mmt
steps:
  - judge: localJudge
    id: j1
    context:
      actual: \${response.body}
    expect:
      semanticSimilarity: 0.9
      criteria:
        - Be concise
    require:
      semanticSimilarity: 0.5
`;
    const t = yamlToTestStrict(yaml) as any;
    expect(getTestFlowStepType(t.steps[0])).toBe('judge');
    expect(t.steps[0].judge).toBe('localJudge');
    expect(t.steps[0].context.actual).toBe('${response.body}');
    expect(t.steps[0].expect.semanticSimilarity).toBe(0.9);
    expect(t.steps[0].expect.criteria).toEqual(['Be concise']);
    expect(t.steps[0].require.semanticSimilarity).toBe(0.5);
  });
});

describe('judge helpers', () => {
  it('normalizes check shorthand', () => {
    expect(normalizeJudgeCheckValue(0.8)).toEqual({threshold: 0.8});
  });

  it('merges defaults with step overrides', () => {
    const judge = objectToJudge({
      type: 'judge',
      engine: 'ollama',
      model: 'x',
      url: 'http://localhost:11434',
      defaults: {
        checks: {semanticSimilarity: 0.5},
        criteria: ['default'],
      },
    });
    const merged = mergeJudgeStepConfig(
        judge, {semanticSimilarity: 0.9}, ['step criterion']);
    expect(merged.checks.semanticSimilarity).toBe(0.9);
    expect(merged.criteria).toEqual(['step criterion']);
  });

  it('unions soft/hard metrics with looser model threshold', () => {
    const union = unionJudgeChecksForModel(
        {semanticSimilarity: 0.9},
        {semanticSimilarity: 0.5});
    expect(union.semanticSimilarity).toBe(0.5);
  });
});

describe('parseJudgeModelJson', () => {
  it('applies threshold and criterion results', () => {
    const req = {
      judge: objectToJudge({
        type: 'judge', engine: 'ollama', model: 'x', url: 'http://x',
      }),
      inputs: {actual: 'a', expected: 'b'},
      checks: {semanticSimilarity: 0.8},
      criteria: ['Be clear', 'Be short'],
    };
    const result = parseJudgeModelJson(
        JSON.stringify({
          checks: {semanticSimilarity: {score: 0.91, passed: false}},
          criteria: [
            {passed: true, reason: 'ok'},
            {passed: false, reason: 'too long'},
          ],
        }),
        req);
    expect(result.checks[0].passed).toBe(true);
    expect(result.criteria[1].passed).toBe(false);
    expect(result.passed).toBe(false);
  });
});

describe('ollama engine evaluateJudge', () => {
  it('posts chat and maps JSON verdict', async () => {
    const judge = objectToJudge({
      type: 'judge',
      engine: 'ollama',
      model: 'qwen3:4b',
      url: 'http://ollama.test',
    });
    const httpPost = jest.fn(async (_args: {
      url: string;
      headers?: Record<string, string>;
      body: any;
      timeoutMs?: number;
    }) => ({
      status: 200,
      statusText: 'OK',
      body: {
        message: {
          content: JSON.stringify({
            checks: {semanticSimilarity: {score: 0.95, passed: true}},
            criteria: [{passed: true, reason: 'good'}],
          }),
        },
      },
    }));

    const result = await evaluateJudge(
        judge,
        {
          inputs: {actual: 'hi', expected: 'hi'},
          checks: {semanticSimilarity: 0.8},
          criteria: ['Be friendly'],
        },
        httpPost);

    expect(httpPost).toHaveBeenCalled();
    const call = httpPost.mock.calls[0][0];
    expect(call.url).toBe('http://ollama.test/api/chat');
    expect(result.passed).toBe(true);
  });
});

describe('cloud judge engines', () => {
  const verdictBody = JSON.stringify({
    checks: {semanticSimilarity: {score: 0.9, passed: true}},
    criteria: [{passed: true, reason: 'ok'}],
  });

  type PostArgs = {
    url: string;
    headers?: Record<string, string>;
    body: any;
    timeoutMs?: number;
  };

  function mockPost(body: any) {
    return jest.fn(async (_args: PostArgs) => ({
      status: 200,
      statusText: 'OK',
      body,
    }));
  }

  it('openai posts chat/completions with bearer auth', async () => {
    const httpPost = mockPost({
      choices: [{message: {content: verdictBody}}],
    });
    const result = await evaluateJudge(
        objectToJudge({
          type: 'judge',
          engine: 'openai',
          model: 'gpt-4o-mini',
          url: 'https://api.openai.com/v1',
          auth: {type: 'bearer', token: 'sk-test'},
        }),
        {inputs: {actual: 'a'}, checks: {semanticSimilarity: 0.5}, criteria: ['c']},
        httpPost);
    expect(httpPost).toHaveBeenCalled();
    const call = httpPost.mock.calls[0][0];
    expect(call.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(call.headers?.Authorization).toBe('Bearer sk-test');
    expect(call.body.response_format).toEqual({type: 'json_object'});
    expect(result.passed).toBe(true);
  });

  it('anthropic posts messages with x-api-key', async () => {
    const httpPost = mockPost({
      content: [{type: 'text', text: verdictBody}],
    });
    const result = await evaluateJudge(
        objectToJudge({
          type: 'judge',
          engine: 'anthropic',
          model: 'claude-3-5-haiku-latest',
          url: 'https://api.anthropic.com',
          auth: {type: 'api-key', header: 'x-api-key', value: 'ant-key'},
        }),
        {inputs: {actual: 'a'}, checks: {semanticSimilarity: 0.5}, criteria: ['c']},
        httpPost);
    const call = httpPost.mock.calls[0][0];
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.headers?.['x-api-key']).toBe('ant-key');
    expect(call.headers?.['anthropic-version']).toBe('2023-06-01');
    expect(call.body.max_tokens).toBe(4096);
    expect(result.passed).toBe(true);
  });

  it('google posts generateContent with x-goog-api-key', async () => {
    const httpPost = mockPost({
      candidates: [{content: {parts: [{text: verdictBody}]}}],
    });
    const result = await evaluateJudge(
        objectToJudge({
          type: 'judge',
          engine: 'google',
          model: 'gemini-2.0-flash',
          url: 'https://generativelanguage.googleapis.com/v1beta',
          auth: {type: 'api-key', header: 'x-goog-api-key', value: 'goog-key'},
        }),
        {inputs: {actual: 'a'}, checks: {semanticSimilarity: 0.5}, criteria: ['c']},
        httpPost);
    const call = httpPost.mock.calls[0][0];
    expect(call.url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    expect(call.headers?.['x-goog-api-key']).toBe('goog-key');
    expect(call.body.generationConfig.responseMimeType).toBe('application/json');
    expect(result.passed).toBe(true);
  });

  it('includes provider error body on google HTTP failure', async () => {
    const httpPost = jest.fn(async () => ({
      status: 404,
      statusText: 'Not Found',
      body: {
        error: {
          message: 'This model models/gemini-2.0-flash is no longer available.',
        },
      },
    }));
    const result = await evaluateJudge(
        objectToJudge({
          type: 'judge',
          engine: 'google',
          model: 'gemini-2.0-flash',
          url: 'https://generativelanguage.googleapis.com/v1beta',
          auth: {type: 'api-key', header: 'x-goog-api-key', value: 'goog-key'},
        }),
        {inputs: {actual: 'a'}, checks: {semanticSimilarity: 0.5}, criteria: []},
        httpPost);
    expect(result.passed).toBe(false);
    expect(result.checks[0]?.details).toMatch(/no longer available/i);
  });

  it('azure-openai posts deployment chat completions', async () => {
    const httpPost = mockPost({
      choices: [{message: {content: verdictBody}}],
    });
    const result = await evaluateJudge(
        objectToJudge({
          type: 'judge',
          engine: 'azure-openai',
          model: 'my-deploy',
          url: 'https://example.openai.azure.com',
          auth: {type: 'api-key', header: 'api-key', value: 'az-key'},
        }),
        {inputs: {actual: 'a'}, checks: {semanticSimilarity: 0.5}, criteria: ['c']},
        httpPost);
    const call = httpPost.mock.calls[0][0];
    expect(call.url).toBe(
        'https://example.openai.azure.com/openai/deployments/my-deploy/chat/completions?api-version=2024-10-21');
    expect(call.headers?.['api-key']).toBe('az-key');
    expect(result.passed).toBe(true);
  });
});

describe('judge_ runtime', () => {
  it('soft expect criteria continue after failure (one report box)', async () => {
    registerJudgeEngine({
      id: 'ollama',
      validate: () => [],
      evaluate: async () => ({
        passed: false,
        checks: [],
        criteria: [{index: 0, text: 'c', passed: false, reason: 'no'}],
      }),
    });
    const judge = objectToJudge({
      type: 'judge', engine: 'ollama', model: 'x', url: 'http://x',
    });
    const reports: any[] = [];
    await judge_(
        judge,
        {context: {actual: 'a'}, expect: {criteria: ['c']}},
        'all', 't', (...args: any[]) => reports.push(args),
        {log: () => {}, debug: () => {}, error: () => {}, trace: () => {}},
        'none');
    expect(reports.length).toBe(1);
    expect(reports[0][0]).toBe('check');
    expect(reports[0][4]).toBe(false);
    expect(Array.isArray(reports[0][1])).toBe(true);
    expect(reports[0][1].length).toBe(1);
  });

  it('require metric throws on hard failure', async () => {
    registerJudgeEngine({
      id: 'ollama',
      validate: () => [],
      evaluate: async () => ({
        passed: false,
        checks: [{
          name: 'semanticSimilarity',
          passed: false,
          score: 0.2,
          threshold: 0.5,
        }],
        criteria: [],
      }),
    });
    const judge = objectToJudge({
      type: 'judge', engine: 'ollama', model: 'x', url: 'http://x',
    });
    let threw = false;
    try {
      await judge_(
          judge,
          {context: {}, require: {semanticSimilarity: 0.5}},
          'all', undefined,
          () => {},
          {log: () => {}, debug: () => {}, error: () => {}, trace: () => {}},
          'none');
    } catch (e) {
      threw = true;
      expect(isAssertionFailedError(e)).toBe(true);
    }
    expect(threw).toBe(true);
  });

  it('soft expect metric does not throw', async () => {
    registerJudgeEngine({
      id: 'ollama',
      validate: () => [],
      evaluate: async () => ({
        passed: false,
        checks: [{
          name: 'semanticSimilarity',
          passed: false,
          score: 0.2,
          threshold: 0.7,
        }],
        criteria: [],
      }),
    });
    const judge = objectToJudge({
      type: 'judge', engine: 'ollama', model: 'x', url: 'http://x',
    });
    await expect(judge_(
        judge,
        {context: {}, expect: {semanticSimilarity: 0.7}},
        'all', undefined,
        () => {},
        {log: () => {}, debug: () => {}, error: () => {}, trace: () => {}},
        'none')).resolves.toMatchObject({hardFailed: false});
  });

  it('evaluates same metric at expect and require thresholds independently', async () => {
    registerJudgeEngine({
      id: 'ollama',
      validate: () => [],
      evaluate: async () => ({
        passed: true,
        checks: [{
          name: 'semanticSimilarity',
          passed: true,
          score: 0.7,
          threshold: 0.5,
        }],
        criteria: [],
      }),
    });
    const judge = objectToJudge({
      type: 'judge', engine: 'ollama', model: 'x', url: 'http://x',
    });
    const reports: any[] = [];
    const result = await judge_(
        judge,
        {
          context: {actual: 'a'},
          expect: {semanticSimilarity: 0.9},
          require: {semanticSimilarity: 0.5},
        },
        'all', 't', (...args: any[]) => reports.push(args),
        {log: () => {}, debug: () => {}, error: () => {}, trace: () => {}},
        'none');

    expect(result.hardFailed).toBe(false);
    expect(reports.length).toBe(1);
    expect(reports[0][0]).toBe('check');  // soft fail only → continue
    const items = reports[0][1] as Array<{
      passed: boolean;
      comparison: string;
      level?: 'expect'|'require';
    }>;
    expect(items).toHaveLength(2);
    const soft = items.find(i => i.level === 'expect');
    const hard = items.find(i => i.level === 'require');
    expect(soft?.passed).toBe(false);   // 0.7 < 0.9
    expect(hard?.passed).toBe(true);    // 0.7 >= 0.5
    expect(soft?.comparison.startsWith('expect ')).toBe(false);
    expect(hard?.comparison.startsWith('require ')).toBe(false);
  });
});

describe('judge codegen', () => {
  it('emits judge_ call with context/expect/require', async () => {
    const steps = [{
      judge: 'localJudge',
      id: 'j1',
      context: {actual: '${response.body}'},
      expect: {semanticSimilarity: 0.9, criteria: ['Be clear']},
      require: {semanticSimilarity: 0.5},
    }] as any;
    const js = await flowStepsToJsfunc(steps, true, false);
    expect(js).toContain("await judge_(localJudge");
    expect(js).toContain('context:');
    expect(js).toContain('expect:');
    expect(js).toContain('require:');
    expect(js).toContain('j1 =');
  });
});

describe('judge builtin checks', () => {
  it('documents built-in checks in the system prompt', () => {
    const prompt = buildJudgeSystemPrompt();
    for (const id of JUDGE_BUILTIN_CHECK_IDS) {
      expect(prompt).toContain(id);
    }
  });
});
