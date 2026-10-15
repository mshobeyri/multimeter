import {
  applyExpectUiRowChange,
  createEmptyExpectUiRow,
  expectDisplayToStored,
  expectMapToUiRows,
  expectStoredToDisplay,
  expectTextUnchanged,
  expectValueToUiRow,
  uiRowToExpectValue,
  uiRowsToExpectMap,
} from '../expectUi';
import {EXPECT_OPERATOR_SAMPLES} from '../expectOperatorSamples';
import {OMIT_SENTINEL} from '../omitKeyword';
import { testToYaml, yamlToTest } from '../testParsePack';

describe('expectUi', () => {
  it('preserves plain numeric == vs explicit == operator', () => {
    const rows = expectMapToUiRows({
      status: ['!= 201', 200, '== 200'],
    });
    expect(rows.map(uiRowToExpectValue)).toEqual(['!= 201', 200, '== 200']);
  });

  it('keeps multiple checks on the same field as a list', () => {
    const original = ['!= 201', 200, '== 200', '=* 2.*', '!* 1.*'];
    const map = uiRowsToExpectMap(expectMapToUiRows({ status: original }));
    expect(map?.status).toEqual(original);
  });

  it('does not quote expects when UI changes operator away from a bang op', () => {
    const yaml = [
      'type: test',
      'steps:',
      '  - call: api',
      '    expect:',
      '      year: != null',
      '      score: >= 80',
      '',
    ].join('\n');
    const test = yamlToTest(yaml);
    const step = test.steps?.[0] as any;
    const rows = expectMapToUiRows(step.expect).map((row) => {
      if (row.field === 'year') {
        return applyExpectUiRowChange(
            applyExpectUiRowChange(row, 'op', '<='),
            'expected',
            '2026',
        );
      }
      if (row.field === 'score') {
        return applyExpectUiRowChange(row, 'op', '<=');
      }
      return row;
    });
    step.expect = uiRowsToExpectMap(rows);
    const out = testToYaml(test, yaml);
    expect(out).toContain('year: <= 2026');
    expect(out).toContain('score: <= 80');
    expect(out).not.toContain('year: "<= 2026"');
    expect(out).not.toContain('score: "<= 80"');
  });

  describe('keeps each operator unquoted after UI change from a bang expect', () => {
    const baseYaml = [
      'type: test',
      'steps:',
      '  - call: api',
      '    expect:',
      '      field: != null',
      '',
    ].join('\n');

    it.each(EXPECT_OPERATOR_SAMPLES)(
        '$op → $value',
        ({value}) => {
          const test = yamlToTest(baseYaml);
          const step = test.steps?.[0] as any;
          const row = expectMapToUiRows(step.expect)[0];
          const [nextOp, ...rest] = value.split(' ');
          const expected = rest.join(' ');
          step.expect = uiRowsToExpectMap([
            applyExpectUiRowChange(
                applyExpectUiRowChange(row, 'op', nextOp),
                'expected',
                expected,
            ),
          ]);
          const out = testToYaml(test, baseYaml);
          expect(out).toContain(`field: ${value}`);
          expect(out).not.toContain(`field: "${value}"`);
        },
    );
  });

  it('round-trips a multi-check expect block through edit-mode serialization', () => {
    const yaml = `
type: test
steps:
  - call: api
    expect:
      status:
        - "!= 201"
        - 200
        - == 200
        - =* 2.*
        - !* 1.*
        - =C 20
        - !C 21
        - =@ 20001
        - =# 3
        - !# 1
`;
    const test = yamlToTest(yaml);
    const step = test.steps?.[0] as any;
    const edited = uiRowsToExpectMap(expectMapToUiRows(step.expect));
    step.expect = edited;

    const roundTripped = testToYaml(test);
    const reparsed = yamlToTest(roundTripped);
    expect((reparsed.steps?.[0] as any).expect.status).toEqual(step.expect.status);
    expect(roundTripped).toContain('- 200');
    expect(roundTripped).toContain('- == 200');
    expect(roundTripped).toContain('- != 201');
    expect(roundTripped).toContain('- !* 1.*');
    expect(roundTripped).not.toContain('- "!= 201"');
    expect(roundTripped).not.toContain('operator: "!="');
  });

  it('maps scalars, empty maps, and row edits', () => {
    expect(expectMapToUiRows(undefined)).toEqual([]);
    expect(uiRowsToExpectMap([])).toBeUndefined();
    expect(expectValueToUiRow('ok', true)).toMatchObject({
      op: '==', expected: 'true', valueKind: 'boolean',
    });
    expect(expectValueToUiRow('msg', 'hello')).toMatchObject({
      op: '==', expected: 'hello', explicitOperator: false,
    });
    expect(expectValueToUiRow('msg', null)).toMatchObject({
      expected: 'null',
      valueKind: 'null',
    });
    expect(expectValueToUiRow('code', '112')).toMatchObject({
      expected: '"112"',
      valueKind: 'string',
    });
    expect(expectValueToUiRow('code', 112)).toMatchObject({
      expected: '112',
      valueKind: 'number',
    });
    expect(expectValueToUiRow('skip', OMIT_SENTINEL)).toMatchObject({
      expected: 'omit',
      valueKind: 'omit',
    });
    expect(applyExpectUiRowChange(
        createEmptyExpectUiRow('x'), 'expected', 'omit',
    )).toMatchObject({
      expected: 'omit',
      valueKind: 'omit',
    });
    expect(applyExpectUiRowChange(
        createEmptyExpectUiRow('x'), 'expected', 'null',
    )).toMatchObject({
      expected: 'null',
      valueKind: 'null',
    });
    expect(uiRowToExpectValue({
      field: 'skip', op: '==', expected: 'omit', explicitOperator: false, valueKind: 'omit',
    })).toBe(OMIT_SENTINEL);
    expect(uiRowToExpectValue({
      field: 'n', op: '==', expected: 'null', explicitOperator: false, valueKind: 'null',
    })).toBe(null);
    expect(uiRowToExpectValue({
      field: 'code', op: '==', expected: '"112"', explicitOperator: false, valueKind: 'string',
    })).toBe('112');
    expect(typeof uiRowToExpectValue({
      field: 'code', op: '==', expected: '"112"', explicitOperator: false, valueKind: 'string',
    })).toBe('string');
    expect(uiRowToExpectValue({
      field: 'n', op: '==', expected: 'nope', explicitOperator: false, valueKind: 'number',
    })).toBe('nope');
    expect(uiRowToExpectValue({
      field: 'b', op: '==', expected: 'false', explicitOperator: false, valueKind: 'boolean',
    })).toBe(false);
    expect(uiRowToExpectValue({
      field: 's', op: '==', expected: 'x', explicitOperator: false, valueKind: 'string',
    })).toBe('x');
    const empty = createEmptyExpectUiRow('status');
    expect(empty).toEqual({
      field: 'status', op: '==', expected: '', explicitOperator: false, valueKind: 'string',
    });
    expect(applyExpectUiRowChange(empty, 'field', 'code').field).toBe('code');
    expect(applyExpectUiRowChange(empty, 'op', '!=')).toMatchObject({
      op: '!=', explicitOperator: true,
    });
    expect(applyExpectUiRowChange(empty, 'expected', '201')).toMatchObject({
      expected: '201',
      valueKind: 'number',
    });
    expect(applyExpectUiRowChange(empty, 'expected', 'true')).toMatchObject({
      valueKind: 'boolean',
    });
    expect(applyExpectUiRowChange(empty, 'expected', '112m')).toMatchObject({
      valueKind: 'string',
    });
    const merged = uiRowsToExpectMap([
      {field: 'a', op: '==', expected: '1', explicitOperator: true},
      {field: 'a', op: '=C', expected: 'x', explicitOperator: true},
      {field: 'a', op: '!=', expected: '9', explicitOperator: true},
    ]);
    expect(merged?.a).toEqual(['== 1', '=C x', '!= 9']);
  });

  it('keeps echo expects literal and whole tokens bare', () => {
    expect(expectStoredToDisplay('xc:not_a_tokeny')).toBe('xc:not_a_tokeny');
    expect(expectDisplayToStored('xc:not_a_tokeny')).toBe('xc:not_a_tokeny');
    expect(expectDisplayToStored(expectStoredToDisplay('xc:not_a_tokeny')))
        .toBe('xc:not_a_tokeny');
    expect(expectStoredToDisplay('c:day')).toBe('{{c:day}}');
    expect(expectDisplayToStored('{{c:day}}')).toBe('c:day');
    expect(expectDisplayToStored('<<c:day>>')).toBe('c:day');
    expect(expectTextUnchanged('c:day', '{{c:day}}')).toBe(true);
    expect(expectTextUnchanged('xc:not_a_tokeny', 'x<<c:not_a_token>>y')).toBe(false);
    expect(expectStoredToDisplay('"c:not_a_token"')).toBe('"c:not_a_token"');
    expect(expectDisplayToStored('"c:not_a_token"')).toBe('"c:not_a_token"');
    expect(expectStoredToDisplay('omit')).toBe('omit');
    expect(expectDisplayToStored('x{{c:day}}y')).toBe('x<<c:day>>y');
    expect(expectDisplayToStored('xr:not_a_tokeny')).toBe('xr:not_a_tokeny');
    expect(expectDisplayToStored('xi:nicknamey')).toBe('xi:nicknamey');
    expect(expectDisplayToStored('xe:regiony')).toBe('xe:regiony');
  });
});
