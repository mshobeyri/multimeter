import {
  buildJudgeEvalBlock,
  flattenJudgeChecksForUi,
  mergeJudgeStepConfig,
  splitJudgeEvalBlock,
  unionJudgeChecksForModel,
} from './JudgeData';

describe('JudgeData eval helpers', () => {
  test('splitJudgeEvalBlock separates metrics and criteria', () => {
    const {metrics, criteria} = splitJudgeEvalBlock({
      semanticSimilarity: 0.9,
      answerRelevance: {threshold: 0.8},
      criteria: ['be polite', 12 as any, 'be brief'],
    });
    expect(metrics).toEqual({
      semanticSimilarity: 0.9,
      answerRelevance: {threshold: 0.8},
    });
    expect(criteria).toEqual(['be polite', 'be brief']);
  });

  test('splitJudgeEvalBlock handles empty/invalid', () => {
    expect(splitJudgeEvalBlock(undefined)).toEqual({metrics: {}, criteria: []});
    expect(splitJudgeEvalBlock(null)).toEqual({metrics: {}, criteria: []});
    expect(splitJudgeEvalBlock([] as any)).toEqual({metrics: {}, criteria: []});
  });

  test('buildJudgeEvalBlock round-trips with split', () => {
    const block = buildJudgeEvalBlock(
        {semanticSimilarity: 0.9, '': 'skip'},
        ['  keep  ', '', 'also'],
    );
    expect(block).toEqual({
      semanticSimilarity: 0.9,
      criteria: ['keep', 'also'],
    });
    expect(splitJudgeEvalBlock(block)).toEqual({
      metrics: {semanticSimilarity: 0.9},
      criteria: ['keep', 'also'],
    });
  });

  test('buildJudgeEvalBlock returns undefined when empty', () => {
    expect(buildJudgeEvalBlock({}, [])).toBeUndefined();
    expect(buildJudgeEvalBlock(undefined, undefined)).toBeUndefined();
  });

  test('flattenJudgeChecksForUi normalizes thresholds', () => {
    expect(flattenJudgeChecksForUi({
      a: 0.5,
      b: {threshold: 0.7, extra: true},
      c: 'strict' as any,
      d: true as any,
    })).toEqual({a: 0.5, b: 0.7, c: 'strict', d: true});
  });

  test('mergeJudgeStepConfig prefers step over defaults', () => {
    const merged = mergeJudgeStepConfig(
        {
          type: 'judge',
          engine: 'ollama',
          model: 'x',
          url: 'http://localhost',
          defaults: {
            checks: {semanticSimilarity: 0.8, factuality: 0.6},
            criteria: ['default'],
          },
        },
        {semanticSimilarity: 0.95},
        ['step'],
    );
    expect(merged.checks).toEqual({
      semanticSimilarity: 0.95,
      factuality: 0.6,
    });
    expect(merged.criteria).toEqual(['step']);
  });

  test('unionJudgeChecksForModel picks looser threshold', () => {
    expect(unionJudgeChecksForModel(
        {semanticSimilarity: 0.9},
        {semanticSimilarity: 0.5, factuality: 0.7},
        )).toEqual({
      semanticSimilarity: 0.5,
      factuality: 0.7,
    });
  });
});
