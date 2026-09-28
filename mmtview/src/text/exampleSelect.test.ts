import {collectExampleNameHits} from './exampleSelect';

describe('collectExampleNameHits', () => {
  it('finds example id value spans (preferred over name)', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'method: get',
      'examples:',
      '  - id: first',
      '    title: First',
      '    inputs:',
      '      a: 1',
      '  - id: "second"',
      '    inputs:',
      '      b: 2',
    ].join('\n');
    const hits = collectExampleNameHits(content);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({exampleIndex: 0, name: 'first'});
    expect(hits[1]).toMatchObject({exampleIndex: 1, name: 'second'});
    expect(content.slice(hits[0].startOffset, hits[0].endOffset)).toContain('first');
    expect(content.slice(hits[1].startOffset, hits[1].endOffset)).toContain('second');
  });

  it('falls back to legacy name when id is missing', () => {
    const content = [
      'type: api',
      'url: https://example.com',
      'method: get',
      'examples:',
      '  - inputs:',
      '      a: 1',
      '  - name: only',
    ].join('\n');
    const hits = collectExampleNameHits(content);
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('only');
    expect(hits[0].exampleIndex).toBe(1);
  });
});
