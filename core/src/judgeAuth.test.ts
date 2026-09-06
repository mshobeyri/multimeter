import {buildJudgeAuth, appendQuery, resolveJudgeBaseUrl} from './judgeAuth';

describe('buildJudgeAuth', () => {
  test('bearer becomes Authorization for openai-style engines', () => {
    const {headers} = buildJudgeAuth('openai', {
      type: 'bearer',
      token: 'sk-test',
    });
    expect(headers.Authorization || headers.authorization).toMatch(/Bearer sk-test/i);
  });

  test('anthropic uses x-api-key and version header', () => {
    const {headers} = buildJudgeAuth('anthropic', {
      type: 'bearer',
      token: 'anth-key',
    });
    expect(headers['x-api-key']).toBe('anth-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(Object.keys(headers).some(k => k.toLowerCase() === 'authorization')).toBe(false);
  });

  test('google uses x-goog-api-key', () => {
    const {headers} = buildJudgeAuth('google', {
      type: 'api-key',
      value: 'g-key',
    });
    expect(headers['x-goog-api-key']).toBe('g-key');
  });

  test('azure-openai uses api-key when no authorization present', () => {
    const {headers} = buildJudgeAuth('azure-openai', {
      type: 'api-key',
      value: 'az-key',
    });
    expect(headers['api-key']).toBe('az-key');
  });

  test('none auth keeps base headers', () => {
    const {headers} = buildJudgeAuth('ollama', 'none', {'Content-Type': 'application/json'});
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('appendQuery / resolveJudgeBaseUrl', () => {
  test('appendQuery skips empty values', () => {
    expect(appendQuery('https://x', {a: '1', b: ''})).toBe('https://x?a=1');
    expect(appendQuery('https://x?z=1', {a: '2'})).toBe('https://x?z=1&a=2');
  });

  test('resolveJudgeBaseUrl strips trailing slashes', () => {
    expect(resolveJudgeBaseUrl('https://x///')).toBe('https://x');
  });
});
