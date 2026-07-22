import { expectMapToUiRows, uiRowToExpectValue, uiRowsToExpectMap } from './expectUi';
import { testToYaml, yamlToTest } from './testParsePack';

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
});
