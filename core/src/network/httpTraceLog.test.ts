import {
  formatHttpTraceBody,
  formatHttpTraceRequest,
  formatHttpTraceResponse,
  HTTP_TRACE_REDACTED,
  redactHttpHeaders,
} from './httpTraceLog';

describe('httpTraceLog', () => {
  test('redacts secret headers', () => {
    expect(redactHttpHeaders({
      Authorization: 'Bearer sk-secret',
      'x-api-key': 'ant',
      'Content-Type': 'application/json',
    })).toEqual({
      Authorization: HTTP_TRACE_REDACTED,
      'x-api-key': HTTP_TRACE_REDACTED,
      'Content-Type': 'application/json',
    });
  });

  test('formats request with headers and body', () => {
    const text = formatHttpTraceRequest({
      method: 'post',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {Authorization: 'Bearer sk', 'Content-Type': 'application/json'},
      body: {model: 'gpt-4o-mini'},
    });
    expect(text).toContain('Request: POST https://api.openai.com/v1/chat/completions');
    expect(text).toContain('Authorization: [redacted]');
    expect(text).toContain('gpt-4o-mini');
    expect(text).not.toContain('Bearer sk');
  });

  test('formats response status first line for load-test parsers', () => {
    const text = formatHttpTraceResponse({
      status: 429,
      durationMs: 80,
      body: {error: {message: 'Too Many Requests'}},
    });
    expect(text.startsWith('Response: 429 (80ms)')).toBe(true);
    expect(text).toContain('Too Many Requests');
  });

  test('truncates large bodies', () => {
    const text = formatHttpTraceBody('x'.repeat(20_000), 100);
    expect(text.startsWith('x'.repeat(100))).toBe(true);
    expect(text).toContain('truncated');
  });
});
