import {describe, expect, it} from '@jest/globals';

function getParentContext(lines: string[], currentIndent: number, firstLine: string): string {
  if (currentIndent === 0) {
    if (firstLine === 'type: api') return 'api';
    if (firstLine === 'type: env') return 'env';
    if (firstLine === 'type: doc') return 'doc';
    if (firstLine === 'type: test') return 'test';
    if (firstLine === 'type: suite') return 'suite';
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) continue;

    const indent = line.search(/\S|$/);
    if (indent < currentIndent) {
      const match = line.trim().match(/^\s*(\w+):/);
      if (match) {
        return match[1];
      }

      if (line.trim().startsWith('- ')) {
        for (let j = i - 1; j >= 0; j--) {
          const upperLine = lines[j];
          if (!upperLine.trim()) continue;
          const upperMatch = upperLine.trim().match(/^\s*(\w+):/);
          if (upperMatch) {
            return upperMatch[1];
          }
        }
      }
      break;
    }
  }
  return 'root';
}

describe('suite autocomplete context', () => {
  it('detects tests: as parent for list items', () => {
    const content = ['type: suite', 'tests:', '  - api1.mmt'];
    const firstLine = content[0].trim();
    const linesBefore = content.slice(0, 2); // before the list item
    const currentIndent = 2; // two spaces before '-'
    expect(getParentContext(linesBefore, currentIndent, firstLine)).toBe('tests');
  });
});
