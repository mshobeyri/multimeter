import * as YAML from 'yaml';
import { emitUnquotedOperators, filterOperatorYamlErrors, quoteExpectOperators } from './expectOperatorYaml';

describe('expectOperatorYaml', () => {
  it('quotes !^ operator in expect block', () => {
    const yaml = 'expect:\n  path: !^ /start';
    expect(quoteExpectOperators(yaml)).toContain('path: "!^ /start"');
  });

  it('quotes >% and fuzzy-percent operators in expect block', () => {
    expect(quoteExpectOperators('expect:\n  name: >% Jon')).toContain('name: ">% Jon"');
    expect(quoteExpectOperators('expect:\n  name: >75% Jon')).toContain('name: ">75% Jon"');
  });

  it('quotes != and !* for dotted, hyphenated, and bracket keys', () => {
    const yaml = [
      'expect:',
      '  _.status: != 100',
      '  Content-Type: != text/plain',
      '  body.items[0]: !* /fail/',
    ].join('\n');
    const quoted = quoteExpectOperators(yaml);
    expect(quoted).toContain('_.status: "!= 100"');
    expect(quoted).toContain('Content-Type: "!= text/plain"');
    expect(quoted).toContain('body.items[0]: "!* /fail/"');
  });

  it('emits unquoted bang-operators from form serialization', () => {
    const yaml = [
      'steps:',
      '  - call: api',
      '    expect:',
      '      status:',
      '        - "!= 201"',
      '        - "!* 1.*"',
      '  - check:',
      '      actual: 1',
      '      operator: "!="',
      '      expected: 2',
    ].join('\n');
    const emitted = emitUnquotedOperators(yaml);
    expect(emitted).toContain('- != 201');
    expect(emitted).toContain('- !* 1.*');
    expect(emitted).toContain('operator: !=');
    expect(emitted).not.toContain('operator: "!="');
  });

  it('keeps block-scalar operators quoted on emit', () => {
    const yaml = 'expect:\n  count: "> 0"\nsteps:\n  - check:\n      operator: ">"\n      actual: x\n      expected: 1';
    const emitted = emitUnquotedOperators(yaml);
    expect(emitted).toContain('count: "> 0"');
    expect(emitted).toContain('operator: ">"');
  });

  it('quotes operator field on check/assert object forms', () => {
    const yaml = [
      'steps:',
      '  - check:',
      '      actual: 1',
      '      operator: !=',
      '      expected: 2',
      '  - assert:',
      '      actual: x',
      '      operator: !*',
      '      expected: /fail/',
    ].join('\n');
    const quoted = quoteExpectOperators(yaml);
    expect(quoted).toContain('operator: "!="');
    expect(quoted).toContain('operator: "!*"');
  });

  it('filters YAML tag errors caused by operator fields on quoted lines', () => {
    const yaml = 'type: test\nsteps:\n  - check:\n      actual: 1\n      operator: !=\n      expected: 2';
    const doc = YAML.parseDocument(yaml);
    expect((doc.warnings || []).length + doc.errors.length).toBeGreaterThan(0);
    expect(filterOperatorYamlErrors(yaml, [...doc.errors, ...(doc.warnings || [])])).toEqual([]);
  });

  it('filters YAML tag errors caused by operators on quoted lines', () => {
    const yaml = 'type: test\nexpect:\n  path: !^ /start';
    const doc = YAML.parseDocument(yaml);
    expect(doc.errors.length).toBeGreaterThan(0);
    expect(filterOperatorYamlErrors(yaml, doc.errors)).toEqual([]);
  });

  it('keeps unrelated YAML errors', () => {
    const yaml = 'type: test\nexpect:\n  path: !^ /start\nbad: [';
    const doc = YAML.parseDocument(yaml);
    const filtered = filterOperatorYamlErrors(yaml, doc.errors);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some(error => String(error.message).includes('path: !^'))).toBe(false);
  });
});
