import {
  mergeJudgeStepConfig,
  normalizeJudgeCheckValue,
  unionJudgeChecksForModel,
} from './JudgeData';
import {
  evaluateJudge,
  parseJudgeModelJson,
  registerJudgeEngine,
} from './judgeEngine';
import './judgeEngineOllama';
import {objectToJudge, validateJudgeObject, yamlToJudgeStrict} from './judgeParsePack';
import {fileType} from './JSerHelper';
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
