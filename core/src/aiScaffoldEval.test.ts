import fs from 'fs';
import path from 'path';

import {apiParsePack} from './index';
import {
  buildApiDetailsSummary,
  scaffoldTestFromApi,
  suggestAliasFromPath,
  suggestTestPath,
} from './testScaffold';
import {testToYaml, validateTestData, yamlToTestStrict} from './testParsePack';

/**
 * Deterministic AI-scaffold eval corpus (no LLM).
 * Measures: scaffold → serialize → strict parse → validateTestData.
 */
const CORPUS: string[] = [
  'examples/ai/golden_smoke/apis/echo.mmt',
  'examples/basic/01_simple_api/get_json.mmt',
  'examples/basic/01_simple_api/post_echo_json_body.mmt',
  'examples/basic/01_simple_api/post_echo_yaml_body.mmt',
  'examples/basic/03_environment_variables/get_json.mmt',
  'examples/basic/05_basic_documentation/api/get_user.mmt',
  'examples/intermediate/08_chained_api_calls/api/login.mmt',
  'examples/intermediate/08_chained_api_calls/api/get_profile.mmt',
];

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

function scaffoldAndValidate(apiRel: string, strategy: 'smoke' | 'example' = 'smoke') {
  const full = path.join(repoRoot(), apiRel);
  const raw = fs.readFileSync(full, 'utf8');
  const api = apiParsePack.yamlToAPIStrict(raw);
  const posixRel = apiRel.replace(/\\/g, '/');
  const summary = buildApiDetailsSummary(posixRel, api);
  const test = scaffoldTestFromApi(api, {
    alias: summary.suggestedAlias || suggestAliasFromPath(posixRel),
    importPath: summary.suggestedImportPath,
    strategy,
  });
  const errors = validateTestData(test);
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
  const yaml = testToYaml(test);
  yamlToTestStrict(yaml);
  return {api, test, yaml, summary};
}

describe('ai scaffold eval corpus', () => {
  it('scaffolds valid tests for every corpus API', () => {
    const results: Array<{api: string; ok: boolean; error?: string}> = [];

    for (const rel of CORPUS) {
      const full = path.join(repoRoot(), rel);
      if (!fs.existsSync(full)) {
        results.push({api: rel, ok: false, error: 'file missing'});
        continue;
      }
      try {
        scaffoldAndValidate(rel, 'smoke');
        results.push({api: rel, ok: true});
      } catch (error: any) {
        results.push({api: rel, ok: false, error: error?.message || String(error)});
      }
    }

    const failed = results.filter(item => !item.ok);
    const passRate = results.length === 0 ?
        0 :
        results.filter(item => item.ok).length / results.length;
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(passRate).toBe(1);
    expect(failed).toEqual([]);
  });

  it('scaffolds API-with-outputs and keeps output expects', () => {
    const {test} = scaffoldAndValidate(
        'examples/basic/05_basic_documentation/api/get_user.mmt');
    expect(test.steps?.[0]).toMatchObject({
      expect: {
        status: 200,
        name: '!= null',
      },
    });
  });

  it('uses nested path imports for non-apis layouts', () => {
    const {summary, test} = scaffoldAndValidate(
        'examples/ai/golden_smoke/apis/echo.mmt');
    expect(summary.suggestedTestPath).toBe(
        'examples/ai/golden_smoke/tests/echo-smoke.mmt');
    expect(suggestTestPath('examples/ai/golden_smoke/apis/echo.mmt'))
        .toBe('examples/ai/golden_smoke/tests/echo-smoke.mmt');
    expect(test.import?.echo).toBe('../apis/echo.mmt');
  });

  it('example strategy uses first example inputs when present', () => {
    const loginRel = 'examples/intermediate/08_chained_api_calls/api/login.mmt';
    const full = path.join(repoRoot(), loginRel);
    const api = apiParsePack.yamlToAPIStrict(fs.readFileSync(full, 'utf8'));
    // Ensure example strategy still validates even without examples (falls back).
    const {test: smoke} = scaffoldAndValidate(loginRel, 'smoke');
    expect(smoke.inputs?.username).toBe('i:username');

    const withExample = {
      ...api,
      examples: [{
        name: 'demo',
        inputs: {username: 'bob@example.com', password: 'pw'},
      }],
    };
    const summary = buildApiDetailsSummary(loginRel.replace(/\\/g, '/'), withExample);
    const test = scaffoldTestFromApi(withExample, {
      alias: summary.suggestedAlias,
      importPath: summary.suggestedImportPath,
      strategy: 'example',
    });
    expect(validateTestData(test)).toEqual([]);
    expect(test.inputs).toEqual({
      username: 'bob@example.com',
      password: 'pw',
    });
    yamlToTestStrict(testToYaml(test));
  });

  it('golden checked-in test matches scaffold output', () => {
    const {yaml} = scaffoldAndValidate('examples/ai/golden_smoke/apis/echo.mmt');
    const checkedIn = fs.readFileSync(
        path.join(repoRoot(), 'examples/ai/golden_smoke/tests/echo-smoke.mmt'),
        'utf8');
    expect(yamlToTestStrict(yaml)).toMatchObject({
      type: 'test',
      import: yamlToTestStrict(checkedIn).import,
      steps: yamlToTestStrict(checkedIn).steps,
    });
  });
});
