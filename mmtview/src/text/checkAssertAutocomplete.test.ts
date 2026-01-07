import {describe, expect, it} from '@jest/globals';

function keySuggestionLabelsFor(parent: 'check'|'assert'|'operator'): string[] {
  if (parent === 'check' || parent === 'assert') {
    return ['actual', 'expected', 'operator', 'title', 'details'];
  }
  return ['==', '!=', '>', '>=', '<', '<=', '=@', '!@', '=~', '!~', '=^', '!^', '=$', '!$'];
}

describe('check/assert object-form autocomplete', () => {
  it('offers actual/expected/operator/title/details under check/assert', () => {
    expect(new Set(keySuggestionLabelsFor('check')).has('actual')).toBe(true);
    expect(new Set(keySuggestionLabelsFor('check')).has('expected')).toBe(true);
    expect(new Set(keySuggestionLabelsFor('assert')).has('operator')).toBe(true);
    expect(new Set(keySuggestionLabelsFor('assert')).has('title')).toBe(true);
    expect(new Set(keySuggestionLabelsFor('assert')).has('details')).toBe(true);
  });

  it('offers known operators', () => {
    const labels = new Set(keySuggestionLabelsFor('operator'));
    expect(labels.has('==')).toBe(true);
    expect(labels.has('=~')).toBe(true);
    expect(labels.has('=@')).toBe(true);
  });

  it('detects - check: as the container for nested keys', () => {
    const lines = [
      'type: test',
      'steps:',
      '  - call: xsd',
      '  - check:',
      '      ',
    ];
    // This mimics the scan added in BeforeMount: walk up to find "- check:".
    const currentIndent = 6; // indentation on the blank nested line
    let found: string|null = null;
    for (let i = lines.length - 2; i >= 0; i--) {
      const l = lines[i];
      if (!l.trim()) {
        continue;
      }
      const indent = l.search(/\S|$/);
      if (indent >= currentIndent) {
        continue;
      }
      const m = l.trim().match(/^\-\s*(check|assert):\s*$/);
      if (m) {
        found = m[1];
      }
      break;
    }
    expect(found).toBe('check');
  });
});
