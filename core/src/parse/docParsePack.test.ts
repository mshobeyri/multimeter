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

  test('docToYaml packs minimal object', () => {
    const yaml = docToYaml({ type: 'doc', title: 'T', sources: ['x'], services: [{ name: 'n', sources: ['y'] }] });
    expect(yaml).toContain('type: doc');
    expect(yaml).toContain('title: T');
    expect(yaml).toContain('- x');
    expect(yaml).toContain('name: n');
    expect(yaml).toContain('- y');
  });

  test('docToYaml does not add title when missing', () => {
    const yaml = docToYaml({ type: 'doc' });
    expect(yaml).toContain('type: doc');
    expect(yaml).not.toContain('title:');
  });

  test('parses html env import logo and ignores invalid yaml', () => {
    const doc = yamlToDoc(`
type: doc
description: D
logo: logo.png
import:
  echo: ./echo.mmt
html:
  triable: true
  cors_proxy: https://proxy
env:
  token: abc
services:
  - description: only desc
`);
    expect(doc.description).toBe('D');
    expect(doc.logo).toBe('logo.png');
    expect(doc.import).toEqual({echo: './echo.mmt'});
    expect(doc.html).toEqual({triable: true, cors_proxy: 'https://proxy'});
    expect(doc.env).toEqual({token: 'abc'});
    expect(doc.services?.[0].description).toBe('only desc');
    expect(yamlToDoc(':::')).toEqual({type: 'doc'});
    expect(yamlToDoc('1')).toEqual({type: 'doc'});

    const packed = docToYaml({
      type: 'doc',
      description: 'D',
      logo: 'l.png',
      import: {a: './a.mmt'},
      html: {triable: false, cors_proxy: 'p'},
      env: {k: 'v'},
      services: [{name: 'n', description: 'd'}],
    });
    expect(packed).toContain('logo: l.png');
    expect(packed).toContain('cors_proxy: p');
    expect(packed).toContain('triable: false');
  });
});
