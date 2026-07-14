import * as YAML from 'yaml';
import { filterOperatorYamlErrors, quoteExpectOperators } from './expectOperatorYaml';

describe('expectOperatorYaml', () => {
  it('quotes !^ operator in expect block', () => {
    const yaml = 'expect:\n  path: !^ /start';
    expect(quoteExpectOperators(yaml)).toContain('path: "!^ /start"');
  });

  it('quotes !% and fuzzy-percent operators in expect block', () => {
    expect(quoteExpectOperators('expect:\n  name: !% Jon')).toContain('name: "!% Jon"');
    expect(quoteExpectOperators('expect:\n  name: !75% Jon')).toContain('name: "!75% Jon"');
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
