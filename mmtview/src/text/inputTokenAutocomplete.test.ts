import { describe, expect, it } from '@jest/globals';

function extractTopLevelInputKeys(raw: string): string[] {
  const lines = String(raw).split(/\r?\n/);
  let inInputs = false;
  let inputsIndent = 0;
  let childIndent: number | null = null;
  const keys: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    if (!inInputs) {
      if (/^inputs:\s*$/.test(trimmed)) {
        inInputs = true;
        inputsIndent = indent;
        childIndent = null;
      }
      continue;
    }

    if (indent <= inputsIndent) {
      break;
    }

    if (childIndent === null) {
      childIndent = indent;
    }

    if (indent !== childIndent) {
      continue;
    }

    const keyMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:/);
    if (keyMatch) {
      keys.push(keyMatch[1]);
    }
  }

  return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b));
}

describe('i: input token autocomplete parsing', () => {
  it('extracts keys from top-level inputs:', () => {
    const raw = [
      'type: test',
      'inputs:',
      '  userId: 123',
      '  name: "Jane"',
      '  snake_case: true',
      '  foo-bar: hi',
      'steps:',
      '  - call: api',
    ].join('\n');

    expect(extractTopLevelInputKeys(raw)).toEqual(['foo-bar', 'name', 'snake_case', 'userId']);
  });

  it('does not include nested keys under inputs values', () => {
    const raw = [
      'type: test',
      'inputs:',
      '  obj:',
      '    inner: 1',
      '  other: 2',
      'steps:',
      '  - call: api',
    ].join('\n');

    expect(extractTopLevelInputKeys(raw)).toEqual(['obj', 'other']);
  });

  it('stops at the next top-level section', () => {
    const raw = [
      'type: test',
      'inputs:',
      '  a: 1',
      'steps:',
      '  - check: { actual: 1, expected: 1, operator: "==" }',
      'inputs:',
      '  b: 2',
    ].join('\n');

    expect(extractTopLevelInputKeys(raw)).toEqual(['a']);
  });
});
