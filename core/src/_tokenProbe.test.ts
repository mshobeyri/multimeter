import {readFileSync} from 'fs';
import {yamlToAPI, apiToYaml} from './apiParsePack';
import {
  peerStringToYaml,
  reviveDisplayRuntimeTokensInValue,
  rewriteAllTokensToDisplayText,
  rewriteRuntimeTokensInText,
  stringContainsFieldToken,
} from './bodyRuntimeTokens';
import {inputBoxToYamlValue, yamlValueToInputBox} from './yamlValueConvert';
import {
  inputBoxToYamlValueWithTokens,
  yamlValueToInputBoxWithTokens,
} from '../../mmtview/src/components/convertor';
import {expectValueToUiRow, uiRowToExpectValue} from './expectUi';
import {formatMmtYaml} from './mmtFormat';
import {yamlToTest, testToYaml} from './testParsePack';

describe('probe', () => {
  it('prints', () => {
    const samples = [
      '__MMT_LITERAL__:c:not_a_token',
      '__MMT_LITERAL__:c:day',
      '__MMT_LITERAL__:xc:not_a_tokeny',
      'xc:not_a_tokeny',
      'x<<c:not_a_token>>y',
      'c:not_a_token',
      'c:day',
      'xe:regiony',
      'xi:nicknamey',
      'xr:not_a_tokeny',
      'asda<<c:day>>',
      '"xc:not_a_tokeny"',
    ];
    for (const s of samples) {
      // eslint-disable-next-line no-console
      console.log('---', JSON.stringify(s));
      // eslint-disable-next-line no-console
      console.log(' rewrite', JSON.stringify(rewriteRuntimeTokensInText(s)));
      // eslint-disable-next-line no-console
      console.log(' all', JSON.stringify(rewriteAllTokensToDisplayText(s)));
      // eslint-disable-next-line no-console
      console.log(' peer', JSON.stringify(peerStringToYaml(s)));
      // eslint-disable-next-line no-console
      console.log(' revive', JSON.stringify(reviveDisplayRuntimeTokensInValue(s)));
      // eslint-disable-next-line no-console
      console.log(' field', stringContainsFieldToken(s));
      // eslint-disable-next-line no-console
      console.log(' box', JSON.stringify(yamlValueToInputBox(s)));
      // eslint-disable-next-line no-console
      console.log(' in', JSON.stringify(inputBoxToYamlValue(s)));
      const row = expectValueToUiRow('missing_embed', s);
      const display = yamlValueToInputBoxWithTokens(
          inputBoxToYamlValueWithTokens(row.expected, true, true) as any,
          true,
          true,
      );
      const committed = yamlValueToInputBox(
          inputBoxToYamlValueWithTokens(display, true, true) as any,
      );
      const stored = uiRowToExpectValue({...row, expected: committed});
      console.log(' row', JSON.stringify(row.expected), 'display', JSON.stringify(display), 'stored', JSON.stringify(stored));
    }
    const yaml = readFileSync(
        'examples/professional/11_token_resolution/api/current_json_body.mmt',
        'utf8',
    );
    const api = yamlToAPI(yaml);
    const again = apiToYaml(api, yaml);
    const expectMap = api.examples?.[0]?.expect as Record<string, unknown>;
    // eslint-disable-next-line no-console
    console.log('parsed missing_embed', JSON.stringify(expectMap?.missing_embed));
    // eslint-disable-next-line no-console
    console.log('parsed missing_token', JSON.stringify(expectMap?.missing_token));
    // eslint-disable-next-line no-console
    console.log('parsed day_name', JSON.stringify(expectMap?.day_name));
    if (again !== yaml) {
      const a = yaml.split('\n');
      const b = again.split('\n');
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          // eslint-disable-next-line no-console
          console.log('DIFF', i + 1, JSON.stringify(a[i]), '=>', JSON.stringify(b[i]));
        }
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('roundtrip identical');
    }
    const formatted = formatMmtYaml(yaml, 'current_json_body.mmt');
    if (formatted.formatted !== yaml) {
      const a = yaml.split('\n');
      const b = formatted.formatted.split('\n');
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          console.log('FMT', i + 1, JSON.stringify(a[i]), '=>', JSON.stringify(b[i]));
        }
      }
    } else {
      console.log('format identical');
    }
    const testYaml = readFileSync(
        'examples/professional/11_token_resolution/test/current_json_body_test.mmt',
        'utf8',
    );
    const test = yamlToTest(testYaml);
    const testAgain = testToYaml(test, testYaml);
    if (testAgain !== testYaml) {
      const a = testYaml.split('\n');
      const b = testAgain.split('\n');
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          console.log('TEST', i + 1, JSON.stringify(a[i]), '=>', JSON.stringify(b[i]));
        }
      }
    } else {
      console.log('test roundtrip identical');
    }
    expect(true).toBe(true);
  });
});
