import {formatMmtYaml} from './mmtFormat';
import {formatMmtYamlAst, reorderMapPairs} from './mmtFormatAst';
import YAML, {isMap} from 'yaml';

const apiYaml = `type: api
title: Echo
url: https://test.mmt.dev/echo
method: post
format: json
body:
  message: hello
`;

function expectAllComments(formatted: string, comments: string[]) {
  for (const comment of comments) {
    expect(formatted).toContain(comment);
  }
}

describe('mmtFormat', () => {
  it('formats api yaml', () => {
    const result = formatMmtYaml(apiYaml, 'echo.mmt');
    expect(result.docType).toBe('api');
    expect(result.formatted).toContain('type: api');
    expect(result.formatted).toContain('title: Echo');
  });

  it('reports unchanged content when already tidy', () => {
    const first = formatMmtYaml(apiYaml, 'echo.mmt');
    const second = formatMmtYaml(first.formatted, 'echo.mmt');
    expect(second.changed).toBe(false);
  });

  it('preserves # comments when formatting', () => {
    const withComments = [
      '# Top-level note',
      'type: api',
      'title: Echo  # inline title comment',
      '# Before url',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: json',
      'body:',
      '  # body field',
      '  message: hello',
      '',
    ].join('\n');

    const result = formatMmtYaml(withComments, 'echo.mmt');
    expectAllComments(result.formatted, [
      '# Top-level note',
      '# inline title comment',
      '# Before url',
      '# body field',
    ]);
    expect(result.formatted).toContain('message: hello');
  });

  it('reorders root keys while keeping comments', () => {
    const shuffled = [
      'url: https://example.com',
      '# keep me',
      'type: api',
      'method: get',
      'title: Shuffled',
      '',
    ].join('\n');
    const result = formatMmtYaml(shuffled, 'a.mmt');
    const typeIdx = result.formatted.indexOf('type: api');
    const titleIdx = result.formatted.indexOf('title: Shuffled');
    const urlIdx = result.formatted.indexOf('url:');
    expect(typeIdx).toBeGreaterThanOrEqual(0);
    expect(titleIdx).toBeGreaterThan(typeIdx);
    expect(urlIdx).toBeGreaterThan(titleIdx);
    expect(result.formatted).toContain('# keep me');
  });

  it('reorders if/else step keys and preserves branch comments', () => {
    const yaml = [
      'type: test',
      'steps:',
      '  - else:',
      '      - print: fail',
      '    steps:',
      '      - print: ok',
      '    # condition comment',
      '    if: status == 200',
      '',
    ].join('\n');
    const formatted = formatMmtYamlAst(yaml, 'test');
    expect(formatted).toMatch(/if: status == 200[\s\S]*steps:[\s\S]*print: ok[\s\S]*else:[\s\S]*print: fail/);
    expect(formatted).toContain('# condition comment');
  });
});

describe('mmtFormat comment preservation', () => {
  it('keeps a file-leading comment block', () => {
    const yaml = [
      '# Owner: platform team',
      '# Last reviewed: 2026-07-23',
      '# Intent: smoke login API',
      'type: api',
      'url: https://test.mmt.dev/echo',
      'method: get',
      '',
    ].join('\n');
    const {formatted} = formatMmtYaml(yaml, 'echo.mmt');
    expectAllComments(formatted, [
      '# Owner: platform team',
      '# Last reviewed: 2026-07-23',
      '# Intent: smoke login API',
    ]);
    expect(formatted.indexOf('# Owner:')).toBeLessThan(formatted.indexOf('type: api'));
  });

  it('keeps a trailing end-of-file comment', () => {
    const yaml = [
      'type: api',
      'url: https://test.mmt.dev/echo',
      'method: get',
      '# end of file note',
      '',
    ].join('\n');
    const {formatted} = formatMmtYaml(yaml, 'echo.mmt');
    expect(formatted).toContain('# end of file note');
    expect(formatted.indexOf('method: get'))
        .toBeLessThan(formatted.indexOf('# end of file note'));
  });

  it('keeps inline, before-key, and blank-line-separated comments', () => {
    const yaml = [
      'type: api',
      'title: Echo # product name',
      '',
      '# --- request ---',
      'method: post',
      'url: https://test.mmt.dev/echo',
      '',
      '',
      '# blank line above is intentional',
      'format: json',
      '',
    ].join('\n');
    const {formatted} = formatMmtYaml(yaml, 'echo.mmt');
    expectAllComments(formatted, [
      '# product name',
      '# --- request ---',
      '# blank line above is intentional',
    ]);
  });

  it('preserves nested comments in body, headers, and examples', () => {
    const yaml = [
      'type: api',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: json',
      'headers:',
      '  # auth header',
      '  Authorization: Bearer token',
      '  # accept json',
      '  Accept: application/json',
      'body:',
      '  # payload root',
      '  user:',
      '    # nested field',
      '    name: ada',
      'examples:',
      '  # first example',
      '  - name: happy',
      '    # example inputs',
      '    inputs:',
      '      name: ada',
      '',
    ].join('\n');
    const {formatted} = formatMmtYaml(yaml, 'echo.mmt');
    expectAllComments(formatted, [
      '# auth header',
      '# accept json',
      '# payload root',
      '# nested field',
      '# first example',
      '# example inputs',
    ]);
    expect(formatted).toContain('Authorization: Bearer token');
    expect(formatted).toContain('name: ada');
  });

  it('preserves comments at multiple depths in test steps and else', () => {
    const yaml = [
      '# test intent: branch coverage',
      'type: test',
      'import:',
      '  # imported api',
      '  echo: ./echo.mmt',
      'inputs:',
      '  # default message',
      '  message: hello',
      'steps:',
      '  # call the echo API',
      '  - call: echo',
      '    id: result',
      '    # pass input through',
      '    inputs:',
      '      message: i:message',
      '  # branch on status',
      '  - if: ${result.status_code} == 200',
      '    steps:',
      '      # success path',
      '      - print: ok',
      '    else:',
      '      # failure path',
      '      - print: fail',
      '# footer',
      '',
    ].join('\n');
    const {formatted} = formatMmtYaml(yaml, 'flow.mmt');
    expectAllComments(formatted, [
      '# test intent: branch coverage',
      '# imported api',
      '# default message',
      '# call the echo API',
      '# pass input through',
      '# branch on status',
      '# success path',
      '# failure path',
      '# footer',
    ]);
  });

  it('preserves comments with different intents (TODO/FIXME/NOTE/disabled)', () => {
    const yaml = [
      '# NOTE: staging only',
      'type: env',
      'variables:',
      '  # TODO: rotate this secret',
      '  api_token:',
      '    local: secret',
      '  # FIXME: wrong default host',
      '  api_url:',
      '    local: https://example.com',
      '  # disabled: keep for rollback',
      '  # old_url:',
      '  #   local: https://legacy.example.com',
      'presets:',
      '  # intent: quick local switch',
      '  runner:',
      '    local:',
      '      api_url: local',
      '',
    ].join('\n');
    const {formatted} = formatMmtYaml(yaml, 'env.mmt');
    expectAllComments(formatted, [
      '# NOTE: staging only',
      '# TODO: rotate this secret',
      '# FIXME: wrong default host',
      '# disabled: keep for rollback',
      '# old_url:',
      '#   local: https://legacy.example.com',
      '# intent: quick local switch',
    ]);
  });

  it('preserves suite and server nested comments after reorder', () => {
    const suiteYaml = [
      'items:',
      '  # run last',
      '  - ./z_test.mmt',
      '  # run first',
      '  - ./a_test.mmt',
      'type: suite',
      '# suite purpose',
      'title: Smoke',
      '',
    ].join('\n');
    const suite = formatMmtYaml(suiteYaml, 'suite.mmt');
    expect(suite.formatted.indexOf('type: suite'))
        .toBeLessThan(suite.formatted.indexOf('title: Smoke'));
    expectAllComments(suite.formatted, [
      '# suite purpose',
      '# run last',
      '# run first',
    ]);

    const serverYaml = [
      'port: 8080',
      'type: server',
      'endpoints:',
      '  # health',
      '  - path: /health',
      '    # always ok',
      '    status: 200',
      '    body:',
      '      # nested body comment',
      '      ok: true',
      '',
    ].join('\n');
    const server = formatMmtYaml(serverYaml, 'mock.mmt');
    expect(server.formatted.indexOf('type: server'))
        .toBeLessThan(server.formatted.indexOf('port:'));
    expectAllComments(server.formatted, [
      '# health',
      '# always ok',
      '# nested body comment',
    ]);
  });

  it('is idempotent when comments are present', () => {
    const yaml = [
      '# begin',
      'type: api',
      'title: Echo # inline',
      '# before url',
      'url: https://test.mmt.dev/echo',
      'method: get',
      'body:',
      '  # nested',
      '  message: hi',
      '# end',
      '',
    ].join('\n');
    const first = formatMmtYaml(yaml, 'echo.mmt');
    const second = formatMmtYaml(first.formatted, 'echo.mmt');
    expect(second.changed).toBe(false);
    expectAllComments(second.formatted, [
      '# begin',
      '# inline',
      '# before url',
      '# nested',
      '# end',
    ]);
  });

  it('keeps comments when reordering shuffled nested maps', () => {
    const yaml = [
      'type: api',
      'grpc:',
      '  message:',
      '    # request name',
      '    name: world',
      '  method: SayHello',
      '  # service first ideally',
      '  service: helloworld.Greeter',
      'url: localhost:50051',
      'protocol: grpc',
      '',
    ].join('\n');
    const {formatted} = formatMmtYaml(yaml, 'grpc.mmt');
    expect(formatted).toMatch(
        /grpc:[\s\S]*service: helloworld\.Greeter[\s\S]*method: SayHello[\s\S]*message:/);
    expectAllComments(formatted, [
      '# request name',
      '# service first ideally',
    ]);
  });
});

describe('reorderMapPairs', () => {
  it('orders known keys first and keeps the rest', () => {
    const doc = YAML.parseDocument('c: 1\na: 2\nb: 3\nd: 4');
    expect(isMap(doc.contents)).toBe(true);
    if (!isMap(doc.contents)) {
      return;
    }
    reorderMapPairs(doc.contents, ['a', 'b', 'c']);
    const keys = doc.contents.items.map((p: any) => String(p.key.value));
    expect(keys).toEqual(['a', 'b', 'c', 'd']);
  });
});
