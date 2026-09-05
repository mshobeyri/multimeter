import fs from 'fs';
import path from 'path';

import {apiParsePack} from './index';
import {
  buildApiDetailsSummary,
  scaffoldTestFromApi,
  suggestAliasFromPath,
} from './testScaffold';
import {testToYaml, validateTestData, yamlToTestStrict} from './testParsePack';

/**
 * Deterministic AI-scaffold eval corpus (no LLM).
 * Measures: scaffold → serialize → strict parse → validateTestData.
 */
const CORPUS: string[] = [
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

describe('ai scaffold eval corpus', () => {
  it('scaffolds valid tests for every corpus API', () => {
    const root = repoRoot();
    const results: Array<{api: string; ok: boolean; error?: string}> = [];

    for (const rel of CORPUS) {
      const full = path.join(root, rel);
      if (!fs.existsSync(full)) {
        results.push({api: rel, ok: false, error: 'file missing'});
        continue;
      }
      try {
        const raw = fs.readFileSync(full, 'utf8');
        const api = apiParsePack.yamlToAPIStrict(raw);
        const apiRel = rel.replace(/\\/g, '/');
        const summary = buildApiDetailsSummary(apiRel, api);
        const test = scaffoldTestFromApi(api, {
          alias: summary.suggestedAlias || suggestAliasFromPath(apiRel),
          importPath: summary.suggestedImportPath,
          strategy: 'smoke',
        });
        const errors = validateTestData(test);
        if (errors.length > 0) {
          results.push({api: rel, ok: false, error: errors.join('; ')});
          continue;
        }
        const yaml = testToYaml(test);
        yamlToTestStrict(yaml);
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
});
