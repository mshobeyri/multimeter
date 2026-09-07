import {
  JUDGE_BUILTIN_CHECK_IDS,
  JUDGE_BUILTIN_CHECKS,
  builtinJudgeCheckIdsCsv,
  builtinJudgeCheckSchemaProperties,
  builtinJudgeDefaultsChecksYaml,
  builtinJudgeEvalSuggestions,
} from './judgeChecks';

describe('judgeChecks schema/autocomplete helpers', () => {
  test('builtinJudgeCheckIdsCsv lists all builtins', () => {
    const csv = builtinJudgeCheckIdsCsv();
    for (const id of JUDGE_BUILTIN_CHECK_IDS) {
      expect(csv).toContain(id);
    }
  });

  test('builtinJudgeCheckSchemaProperties keys match builtins', () => {
    const props = builtinJudgeCheckSchemaProperties();
    expect(Object.keys(props).sort()).toEqual([...JUDGE_BUILTIN_CHECK_IDS].sort());
    for (const id of JUDGE_BUILTIN_CHECK_IDS) {
      expect(props[id].anyOf).toBeDefined();
      expect(typeof props[id].description).toBe('string');
    }
  });

  test('builtinJudgeCheckSchemaProperties can omit descriptions', () => {
    const props = builtinJudgeCheckSchemaProperties({includeDescription: false});
    expect(props.semanticSimilarity.description).toBeUndefined();
  });

  test('builtinJudgeDefaultsChecksYaml uses first two defaults', () => {
    const yaml = builtinJudgeDefaultsChecksYaml(2);
    expect(yaml).toContain(`semanticSimilarity: ${JUDGE_BUILTIN_CHECKS[0].defaultThreshold}`);
    expect(yaml).toContain(`answerRelevance: ${JUDGE_BUILTIN_CHECKS[1].defaultThreshold}`);
    expect(yaml.split('\n')).toHaveLength(2);
  });

  test('builtinJudgeEvalSuggestions covers every builtin', () => {
    const suggestions = builtinJudgeEvalSuggestions();
    expect(suggestions.map(s => s.id)).toEqual([...JUDGE_BUILTIN_CHECK_IDS]);
    for (const s of suggestions) {
      expect(s.insertText).toContain(`${s.id}:`);
      expect(s.documentation.length).toBeGreaterThan(0);
    }
  });
});
