import {matchTestStepLine} from './testStepTypes';

describe('matchTestStepLine', () => {
  it('matches call and http steps', () => {
    expect(matchTestStepLine('- call: login')).toBe('call');
    expect(matchTestStepLine('- http: https://test.mmt.dev/echo')).toBe('http');
    expect(matchTestStepLine('  - http: https://x')).toBeNull(); // must be trimmed
  });

  it('matches common control/flow steps', () => {
    expect(matchTestStepLine('- check:')).toBe('check');
    expect(matchTestStepLine('- assert: x == 1')).toBe('assert');
    expect(matchTestStepLine('- judge: local')).toBe('judge');
    expect(matchTestStepLine('- if: true')).toBe('if');
    expect(matchTestStepLine('- setenv:')).toBe('setenv');
  });

  it('rejects non-step lines', () => {
    expect(matchTestStepLine('http: https://x')).toBeNull();
    expect(matchTestStepLine('- title: Hello')).toBeNull();
    expect(matchTestStepLine('call: login')).toBeNull();
  });
});

/**
 * Mirror the sibling walk used in registerYamlAutocomplete: from a blank sibling
 * line under a step, recover step-<type> for KeySuggestionsByParent.
 */
function siblingStepKey(
    lines: string[],
    cursorLineIndex: number,
    currentIndent: number,
    ): string | null {
  for (let i = cursorLineIndex - 1; i >= 0; i--) {
    const l = lines[i];
    if (!l.trim()) {
      continue;
    }
    const indent = l.search(/\S|$/);
    if (indent > currentIndent) {
      continue;
    }
    if (indent === currentIndent && !l.trim().startsWith('- ')) {
      continue;
    }
    const stepType = matchTestStepLine(l.trim());
    if (stepType) {
      return `step-${stepType}`;
    }
    break;
  }
  return null;
}

describe('http step sibling autocomplete context', () => {
  it('resolves step-http under an http step', () => {
    const lines = [
      'type: test',
      'steps:',
      '  - http: https://test.mmt.dev/echo',
      '    ',
    ];
    expect(siblingStepKey(lines, 3, 4)).toBe('step-http');
  });

  it('still resolves step-call under a call step', () => {
    const lines = [
      'type: test',
      'steps:',
      '  - call: login',
      '    ',
    ];
    expect(siblingStepKey(lines, 3, 4)).toBe('step-call');
  });
});
