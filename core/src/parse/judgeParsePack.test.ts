import {
  isJudgeEngineId,
  judgeToYaml,
  objectToJudge,
  validateJudgeObject,
  yamlToJudge,
  yamlToJudgeStrict,
} from './judgeParsePack';

describe('judgeParsePack', () => {
  it('parses and serializes auth none, tags, and defaults criteria', () => {
    const yaml = `
type: judge
title: T
description: D
tags:
  - a
engine: custom-engine
model: m
url: http://x
auth: none
options:
  temperature: 0
defaults:
  criteria:
    - Be kind
    - ''
  checks:
    semanticSimilarity: 0.5
`;
    const j = yamlToJudge(yaml);
    expect(j.auth).toBe('none');
    expect(j.tags).toEqual(['a']);
    expect(j.defaults?.criteria).toEqual(['Be kind']);
    const out = judgeToYaml(j);
    expect(out).toContain('type: judge');
    expect(out).toContain('auth: none');
    expect(out).toContain('Be kind');
  });

  it('validates required fields and unknown keys', () => {
    expect(validateJudgeObject(null)).toEqual(['Judge file must be a YAML object']);
    expect(validateJudgeObject([])).toEqual(['Judge file must be a YAML object']);
    const errors = validateJudgeObject({
      type: 'api',
      extra: 1,
      auth: [],
      options: [],
      defaults: [],
      url: 1,
    });
    expect(errors).toEqual(expect.arrayContaining([
      'type must be "judge"',
      'Unknown key "extra"',
      'engine is required',
      'model is required',
      'url must be a string',
      'auth must be an object or "none"',
      'options must be an object',
      'defaults must be an object',
    ]));
    expect(validateJudgeObject({
      type: 'judge',
      engine: 'ollama',
      model: 'm',
      url: 'http://x',
      auth: {token: 'x'},
    })).toContain('auth.type is required');
  });

  it('rejects invalid objects and incomplete auth', () => {
    expect(() => objectToJudge(null)).toThrow(/expected a YAML object/);
    expect(objectToJudge({engine: 'e', model: 'm', url: 'u', auth: {type: ''}}).auth)
        .toBeUndefined();
    expect(objectToJudge({engine: 'e', model: 'm', url: 'u', options: []}).options)
        .toBeUndefined();
    expect(objectToJudge({engine: 'e', model: 'm', url: 'u', defaults: []}).defaults)
        .toBeUndefined();
    expect(isJudgeEngineId('ollama')).toBe(true);
    expect(isJudgeEngineId('nope')).toBe(false);
  });

  it('throws on strict unknown keys', () => {
    expect(() => yamlToJudgeStrict(`
type: judge
engine: ollama
model: m
url: http://x
oops: 1
`)).toThrow(/Unknown key "oops"/);
  });
});
