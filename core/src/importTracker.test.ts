import {ImportTracker} from './importTracker';

describe('ImportTracker', () => {
  it('tracks visited paths', () => {
    const t = new ImportTracker();
    expect(t.wasVisited('/a')).toBe(false);
    t.markVisited('/a');
    expect(t.wasVisited('/a')).toBe(true);
  });

  it('records first import path only (deterministic)', () => {
    const t = new ImportTracker();
    t.recordImportPath('/x', ['/root/main.mmt', '/x']);
    t.recordImportPath('/x', ['/other/alt.mmt', '/x']);
    expect(t.getImportPath('/x')).toEqual(['/root/main.mmt', '/x']);
  });

  it('stores aliases per importing file', () => {
    const t = new ImportTracker();
    expect(t.getAliasesForImporter('/root/main.mmt')).toEqual({});
    t.setAliasesForImporter('/root/main.mmt', {m: 'my_file'});
    expect(t.getAliasesForImporter('/root/main.mmt')).toEqual({m: 'my_file'});
  });
});
