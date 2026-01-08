import { describe, expect, it } from '@jest/globals';

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

describe('steps list item autocomplete', () => {
  it('detects parentContext=steps on dash lines', () => {
    const docLines = [
      'type: test',
      'steps:',
      '  - ',
    ];
    const firstLine = docLines[0].trim();
    const currentLine = docLines[2];
    const currentIndent = currentLine.search(/\S|$/);
    const parentContext = getParentContext(docLines.slice(0, 2), currentIndent, firstLine);
    expect(parentContext).toBe('steps');
  });

  it('does not suggest duplicating the dash when already typed', () => {
    const trimmedLine = '- ';
    const insertText = '- call: ';
    const adjusted = trimmedLine.startsWith('-') && insertText.startsWith('- ') ? insertText.slice(2) : insertText;
    expect(adjusted).toBe('call: ');
  });
});
