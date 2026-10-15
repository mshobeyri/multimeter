import {
  formatBytes,
  modelMatchesConfigured,
  parseModels,
  probeHeadersForEngine,
  probeUrlForEngine,
  shouldAutoProbeJudge,
} from './judgeProbe';

describe('judgeProbe helpers', () => {
  test('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(undefined)).toBeUndefined();
  });

  test('modelMatchesConfigured handles tags and google prefixes', () => {
    expect(modelMatchesConfigured('qwen2.5:3b', 'qwen2.5')).toBe(true);
    expect(modelMatchesConfigured('models/gemini-2.0-flash', 'gemini-2.0-flash')).toBe(true);
    expect(modelMatchesConfigured('other', 'qwen')).toBe(false);
  });

  test('probeUrlForEngine builds engine paths', () => {
    expect(probeUrlForEngine('ollama', 'http://localhost:11434'))
        .toBe('http://localhost:11434/api/tags');
    expect(probeUrlForEngine('openai', 'https://api.openai.com/v1'))
        .toBe('https://api.openai.com/v1/models');
    expect(probeUrlForEngine('anthropic', 'https://api.anthropic.com'))
        .toBe('https://api.anthropic.com/v1/models');
    expect(probeUrlForEngine('google', 'https://generativelanguage.googleapis.com/v1beta'))
        .toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100');
    expect(probeUrlForEngine('azure-openai', 'https://ex.openai.azure.com'))
        .toBe('https://ex.openai.azure.com/openai/models?api-version=2024-10-21');
  });

  test('parseModels for openai and ollama', () => {
    expect(parseModels('openai', {data: [{id: 'gpt-4o', owned_by: 'openai'}]}))
        .toEqual([{name: 'gpt-4o', detail: 'openai'}]);
    expect(parseModels('ollama', {
      models: [{
        name: 'llama3',
        size: 1024,
        details: {parameter_size: '8B', family: 'llama'},
      }],
    })).toEqual([{
      name: 'llama3',
      sizeLabel: '1.0 KB',
      detail: '8B · llama',
      modifiedAt: undefined,
    }]);
  });

  test('probeHeadersForEngine delegates to buildJudgeAuth', () => {
    const headers = probeHeadersForEngine('anthropic', {type: 'bearer', token: 'k'}, {});
    expect(headers['x-api-key']).toBe('k');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  test('shouldAutoProbeJudge only for local Ollama', () => {
    expect(shouldAutoProbeJudge('ollama')).toBe(true);
    expect(shouldAutoProbeJudge('OpenAI')).toBe(false);
    expect(shouldAutoProbeJudge('anthropic')).toBe(false);
    expect(shouldAutoProbeJudge('google')).toBe(false);
    expect(shouldAutoProbeJudge('azure-openai')).toBe(false);
  });
});
