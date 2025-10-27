import { yamlToDoc, docToYaml } from './docParsePack';

describe('docParsePack', () => {
  test('yamlToDoc parses sources and services', () => {
    const yaml = `
      type: doc
      title: My Doc
      sources:
        - apis
        - extra/file.mmt
      services:
        - name: svc1
          sources:
            - svc1/apis
    `;
    const doc = yamlToDoc(yaml);
    expect(doc.type).toBe('doc');
    expect(doc.title).toBe('My Doc');
    expect(doc.sources).toEqual(['apis', 'extra/file.mmt']);
    expect(doc.services?.[0]).toEqual({ name: 'svc1', sources: ['svc1/apis'] });
  });

  test('legacy fields files/folders map into sources', () => {
    const yaml = `
      type: doc
      title: Legacy
      files: [a.mmt]
      folders: [foo]
      services:
        - name: s
          files: [b.mmt]
          folders: [bar]
    `;
    const doc = yamlToDoc(yaml);
    expect(doc.sources).toEqual(['a.mmt', 'foo']);
    expect(doc.services?.[0].sources).toEqual(['b.mmt', 'bar']);
  });

  test('docToYaml packs minimal object', () => {
    const yaml = docToYaml({ type: 'doc', title: 'T', sources: ['x'], services: [{ name: 'n', sources: ['y'] }] });
    expect(yaml).toContain('type: doc');
    expect(yaml).toContain('title: T');
    expect(yaml).toContain('- x');
    expect(yaml).toContain('name: n');
    expect(yaml).toContain('- y');
  });
});
