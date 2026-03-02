import {describe, expect, it} from '@jest/globals';

function keySuggestionLabelsFor(parent: 'check'|'assert'|'operator'): string[] {
  if (parent === 'check' || parent === 'assert') {
    return ['actual', 'expected', 'operator', 'title', 'details', 'report'];
  }
  return ['==', '!=', '>', '>=', '<', '<=', '=@', '!@', '=~', '!~', '=^', '!^', '=$', '!$'];
}

describe('check/assert object-form autocomplete', () => {
  it('offers actual/expected/operator/title/details/report under check/assert', () => {
    expect(new Set(keySuggestionLabelsFor('check')).has('actual')).toBe(true);
    expect(new Set(keySuggestionLabelsFor('check')).has('expected')).toBe(true);
    expect(new Set(keySuggestionLabelsFor('assert')).has('operator')).toBe(true);
    expect(new Set(keySuggestionLabelsFor('assert')).has('title')).toBe(true);
    expect(new Set(keySuggestionLabelsFor('assert')).has('details')).toBe(true);
    expect(new Set(keySuggestionLabelsFor('assert')).has('report')).toBe(true);
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
/**
 * Replicate getCallAliasForCheckContext from BeforeMount.tsx for testing.
 * Detects if cursor is inside check:/assert: list of a call step.
 */
function getCallAliasForCheckContext(
    lines: string[], lineNumber: number, currentIndent: number
): { alias: string; field: string } | null {
  let foundField = false;
  let fieldIndent = -1;
  let field = '';
  for (let i = lineNumber - 2; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) { continue; }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    if (!foundField) {
      if (indent < currentIndent && /^(check|assert):\s*$/.test(trimmed)) {
        foundField = true;
        fieldIndent = indent;
        field = trimmed.replace(/:.*/, '');
        continue;
      }
      if (indent < currentIndent) { return null; }
      continue;
    }

    if (indent < fieldIndent) {
      const callMatch = trimmed.match(/^-\s*call:\s*(.+)$/);
      if (callMatch) {
        return { alias: callMatch[1].trim().replace(/^["']|["']$/g, ''), field };
      }
      return null;
    }
  }
  return null;
}

describe('inline call check/assert autocomplete context', () => {
  it('detects check: under a call step', () => {
    const lines = [
      'type: test',
      'steps:',
      '  - call: login',
      '    check:',
      '      - ',
    ];
    // lineNumber is 1-based; line 5 is the cursor line
    const result = getCallAliasForCheckContext(lines, 5, 8);
    expect(result).toEqual({ alias: 'login', field: 'check' });
  });

  it('detects assert: under a call step', () => {
    const lines = [
      'type: test',
      'steps:',
      '  - call: getUser',
      '    inputs:',
      '      id: 123',
      '    assert:',
      '      - ',
    ];
    const result = getCallAliasForCheckContext(lines, 7, 8);
    expect(result).toEqual({ alias: 'getUser', field: 'assert' });
  });

  it('returns null when check: is under a standalone check step', () => {
    const lines = [
      'type: test',
      'steps:',
      '  - check:',
      '      ',
    ];
    // check: at indent 4 → looking for call above it, no call found
    const result = getCallAliasForCheckContext(lines, 4, 6);
    expect(result).toBeNull();
  });

  it('returns null when not under a call step', () => {
    const lines = [
      'type: test',
      'steps:',
      '  - print: hello',
      '    check:',
      '      - ',
    ];
    // print step doesn't have call:
    const result = getCallAliasForCheckContext(lines, 5, 8);
    expect(result).toBeNull();
  });

  it('handles call alias with quotes', () => {
    const lines = [
      'type: test',
      'steps:',
      '  - call: "my_api"',
      '    check:',
      '      - ',
    ];
    const result = getCallAliasForCheckContext(lines, 5, 8);
    expect(result).toEqual({ alias: 'my_api', field: 'check' });
  });
});