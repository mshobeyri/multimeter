import {resolveYamlText} from './resolveYamlText';

describe('resolveYamlText', () => {
  it('resolves e: and i: into a request-only copy by default', () => {
    const yaml = [
      'type: api',
      'title: Users',
      'description: list users',
      'inputs:',
      '  name: alice',
      'outputs:',
      '  id: $.id',
      'examples:',
      '  - name: bob',
      '    inputs:',
      '      name: bob',
      'url: http://<<e:HOST>>/users/<<i:name>>',
      'headers:',
      '  X-Request-Id: r:uuid',
      '',
    ].join('\n');

    const out = resolveYamlText({
      yamlText: yaml,
      inputs: {name: 'bob'},
      env: {HOST: 'api.local'},
    });

    expect(out).toContain('type: api');
    expect(out).toContain('url: http://api.local/users/bob');
    expect(out).toContain('X-Request-Id: r:uuid');
    expect(out).not.toContain('title:');
    expect(out).not.toContain('description:');
    expect(out).not.toContain('inputs:');
    expect(out).not.toContain('outputs:');
    expect(out).not.toContain('examples:');
  });

  it('preserves comments on request fields via AST merge', () => {
    const yaml = [
      'type: api',
      'title: Dropped',
      '# base host',
      'url: e:HOST',
      'inputs:',
      '  name: alice',
      '',
    ].join('\n');

    const out = resolveYamlText({
      yamlText: yaml,
      env: {HOST: 'https://example.com'},
    });

    expect(out).toContain('# base host');
    expect(out).toContain('url: https://example.com');
    expect(out).not.toContain('title:');
    expect(out).not.toContain('inputs:');
  });

  it('uses file input defaults when UI inputs omit a key', () => {
    const yaml = [
      'type: api',
      'inputs:',
      '  user: e:USER',
      '  role: guest',
      'url: https://example.com/<<i:user>>',
      'headers:',
      '  X-Role: i:role',
      '',
    ].join('\n');

    const out = resolveYamlText({
      yamlText: yaml,
      inputs: {role: 'admin'},
      env: {USER: 'mehrdad'},
    });

    expect(out).toContain('url: https://example.com/mehrdad');
    expect(out).toContain('X-Role: admin');
    expect(out).not.toContain('inputs:');
  });

  it('leaves missing env tokens unresolved', () => {
    const yaml = [
      'type: api',
      'url: e:MISSING',
      '',
    ].join('\n');

    const out = resolveYamlText({yamlText: yaml, env: {}});
    expect(out).toContain('url: e:MISSING');
  });

  it('can keep the full document when requestOnly is false', () => {
    const yaml = [
      'type: api',
      'title: Keep me',
      'url: e:HOST',
      '',
    ].join('\n');

    const out = resolveYamlText({
      yamlText: yaml,
      env: {HOST: 'https://example.com'},
      requestOnly: false,
    });

    expect(out).toContain('title: Keep me');
    expect(out).toContain('url: https://example.com');
  });

  it('throws when YAML is not an object document', () => {
    expect(() => resolveYamlText({yamlText: 'just a string'})).toThrow(/valid YAML/);
  });
});
