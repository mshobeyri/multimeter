import {formatMmtYaml} from './mmtFormat';

const apiYaml = `type: api
title: Echo
url: https://test.mmt.dev/echo
method: post
format: json
body:
  message: hello
`;

describe('mmtFormat', () => {
  it('formats api yaml canonically', () => {
    const result = formatMmtYaml(apiYaml, 'echo.mmt');
    expect(result.docType).toBe('api');
    expect(result.formatted).toContain('type: api');
    expect(result.formatted).toContain('title: Echo');
  });

  it('reports unchanged content', () => {
    const first = formatMmtYaml(apiYaml, 'echo.mmt');
    const second = formatMmtYaml(first.formatted, 'echo.mmt');
    expect(second.changed).toBe(false);
  });
});
