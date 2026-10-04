import {readFileSync} from 'fs';
import {apiToYaml, yamlToAPI} from './apiParsePack';
import {testToYaml, yamlToTest} from './testParsePack';
import {scalarFingerprint} from './yamlAuthoredScalars';

describe('scalarFingerprint', () => {
  it('treats token spellings as the same value and quoted keywords as different', () => {
    expect(scalarFingerprint('<<c:epoch>>')).toBe(scalarFingerprint('c:epoch'));
    expect(scalarFingerprint('"{{c:day}}"')).toBe(scalarFingerprint('c:day'));
    expect(scalarFingerprint('"<<c:day>>"')).toBe(scalarFingerprint('c:day'));
    expect(scalarFingerprint('"c:day"')).not.toBe(scalarFingerprint('c:day'));
    expect(scalarFingerprint('"c:day"')).not.toBe(scalarFingerprint('"{{c:day}}"'));
    expect(scalarFingerprint('> 1700000000')).toBe(scalarFingerprint('"> 1700000000"'));
    expect(scalarFingerprint('"!= null"')).toBe(scalarFingerprint('!= null'));
    expect(scalarFingerprint('"xc:not_a_tokeny"'))
        .not.toBe(scalarFingerprint('"x<<c:not_a_token>>y"'));
    expect(scalarFingerprint('"112"')).not.toBe(scalarFingerprint('112'));
    expect(scalarFingerprint('"omit"')).not.toBe(scalarFingerprint('omit'));
  });
});

describe('authored yaml on resave', () => {
  const header = readFileSync(
      'examples/professional/11_token_resolution/api/current_header.mmt',
      'utf8',
  );
  const jsonBody = readFileSync(
      'examples/professional/11_token_resolution/api/current_json_body.mmt',
      'utf8',
  );
  const headerTest = readFileSync(
      'examples/professional/11_token_resolution/test/current_header_test.mmt',
      'utf8',
  );

  it('does not rewrite expects or tokens when the model is unchanged', () => {
    expect(apiToYaml(yamlToAPI(header), header)).toBe(header);
    expect(apiToYaml(yamlToAPI(jsonBody), jsonBody)).toBe(jsonBody);
    expect(testToYaml(yamlToTest(headerTest), headerTest)).toBe(headerTest);
    expect(header).toContain('missing_embed: "xc:not_a_tokeny"');
    expect(jsonBody).toContain('epoch_seconds: > 1700000000');
    expect(headerTest).toContain('curly_whole: "!= null"');
  });

  it('keeps untouched expects when another field is edited', () => {
    const api = yamlToAPI(header);
    api.title = 'Renamed header sample';
    const out = apiToYaml(api, header);
    expect(out).toContain('title: Renamed header sample');
    expect(out).toContain('missing_embed: "xc:not_a_tokeny"');
    expect(out).toContain('X-Angle-Whole: <<c:epoch>>');
    expect(out).toContain('X-Quoted-Angle: "<<c:day>>"');
    expect(out).toContain('X-Quoted-Curly: "{{c:day}}"');
    expect(out).toContain('X-Curly-Whole: {{c:city}}');
    expect(out).not.toContain('missing_embed: "x<<c:not_a_token>>y"');
  });

  it('keeps an edited expect and the echo line beside it', () => {
    const api = yamlToAPI(jsonBody);
    const example = api.examples?.[0];
    if (!example?.expect) {
      throw new Error('missing example expect');
    }
    example.expect.day_name = 'c:month';
    const out = apiToYaml(api, jsonBody);
    expect(out).toContain('day_name: c:month');
    expect(out).toContain('missing_embed: "xc:not_a_tokeny"');
    expect(out).toContain('epoch_seconds: > 1700000000');
    expect(out).toContain('quoted_angle: "<<c:day>>"');
    expect(out).toContain('curly_whole: {{c:city}}');
  });

  it('keeps a literal expect when it is edited into a live token', () => {
    const api = yamlToAPI(header);
    const example = api.examples?.[0];
    if (!example?.expect) {
      throw new Error('missing example expect');
    }
    example.expect.literal_token = 'c:day';
    const out = apiToYaml(api, header);
    expect(out).toContain('literal_token: c:day');
    expect(out).not.toMatch(/literal_token:\s+"c:day"/);
    expect(out).toContain('missing_embed: "xc:not_a_tokeny"');
    expect(out).toContain('missing_token: "c:not_a_token"');
  });
});
