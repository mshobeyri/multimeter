import {
  formatBytes,
  modelMatchesConfigured,
  parseModels,
  probeHeadersForEngine,
  probeUrlForEngine,
} from './judgeProbeHelpers';
import {
  defaultUrlForEngine,
  isDefaultJudgeUrl,
} from './judgeEngineDefaults';

describe('judgeProbe helpers', () => {
  it('builds probe urls per engine', () => {
    expect(probeUrlForEngine('ollama', 'http://127.0.0.1:11434/'))
        .toBe('http://127.0.0.1:11434/api/tags');
    expect(probeUrlForEngine('openai', 'https://api.openai.com/v1'))
        .toBe('https://api.openai.com/v1/models');
    expect(probeUrlForEngine('anthropic', 'https://api.anthropic.com'))
        .toBe('https://api.anthropic.com/v1/models');
    expect(probeUrlForEngine('google', 'https://generativelanguage.googleapis.com/v1beta'))
        .toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100');
    expect(probeUrlForEngine('azure-openai', 'https://example.openai.azure.com'))
        .toBe('https://example.openai.azure.com/openai/models?api-version=2024-10-21');
  });

  it('parses ollama / openai / anthropic / google payloads', () => {
    expect(parseModels('ollama', {
      models: [{
        name: 'qwen2.5:3b',
        size: 2 * 1024 * 1024 * 1024,
        details: {parameter_size: '3.2B', quantization_level: 'Q4_K_M'},
      }],
    })[0]).toMatchObject({
      name: 'qwen2.5:3b',
      sizeLabel: '2.0 GB',
      detail: '3.2B · Q4_K_M',
    });

    expect(parseModels('openai', {
      data: [{id: 'gpt-4o-mini', owned_by: 'openai'}],
    })).toEqual([{name: 'gpt-4o-mini', detail: 'openai'}]);

    expect(parseModels('anthropic', {
      data: [{id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5'}],
    })).toEqual([{name: 'claude-sonnet-4-5', detail: 'Claude Sonnet 4.5'}]);

    expect(parseModels('google', {
      models: [{
        name: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        supportedGenerationMethods: ['generateContent'],
      }],
    })).toEqual([{name: 'gemini-2.0-flash', detail: 'Gemini 2.0 Flash'}]);
  });

  it('adds engine-specific auth headers', () => {
    expect(probeHeadersForEngine('anthropic', {type: 'bearer', token: 'sk'}, {}))
        .toMatchObject({
          'x-api-key': 'sk',
          'anthropic-version': '2023-06-01',
        });
    expect(probeHeadersForEngine('google', {type: 'api-key', value: 'gkey'}, {}))
        .toMatchObject({'x-goog-api-key': 'gkey'});
    expect(probeHeadersForEngine('azure-openai', {type: 'bearer', token: 'az'}, {}))
        .toMatchObject({'api-key': 'az'});
  });

  it('matches configured model names', () => {
    expect(modelMatchesConfigured('qwen2.5:3b', 'qwen2.5:3b')).toBe(true);
    expect(modelMatchesConfigured('qwen2.5:3b', 'qwen2.5')).toBe(true);
    expect(modelMatchesConfigured('gemini-2.0-flash', 'gemini-2.0-flash')).toBe(true);
    expect(modelMatchesConfigured('gpt-4o', 'gpt-4o-mini')).toBe(false);
  });

  it('formats bytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('provides default urls per engine', () => {
    expect(defaultUrlForEngine('ollama')).toBe('http://127.0.0.1:11434');
    expect(defaultUrlForEngine('openai')).toBe('https://api.openai.com/v1');
    expect(isDefaultJudgeUrl('ollama', 'http://127.0.0.1:11434/')).toBe(true);
    expect(isDefaultJudgeUrl('ollama', 'http://localhost:11434')).toBe(false);
  });
});
