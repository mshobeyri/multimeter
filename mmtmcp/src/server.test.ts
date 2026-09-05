import {buildValidationSuggestions} from './tools/handlers';
import {SERVER_INSTRUCTIONS, createMmtMcpServer} from './server';

describe('Multimeter MCP server', () => {
  it('exposes Copilot-facing tools with clear descriptions', () => {
    const server = createMmtMcpServer();
    expect(server).toBeDefined();
    expect(SERVER_INSTRUCTIONS).toContain('FIRST tool-call batch');
    expect(SERVER_INSTRUCTIONS).toContain('read_documentation');
    expect(SERVER_INSTRUCTIONS).toContain('scaffold_test');
    expect(SERVER_INSTRUCTIONS).toContain('validate');
  });

  it('builds actionable validation suggestions', () => {
    const suggestions = buildValidationSuggestions([
      'call step is missing required "id" field',
      'Invalid test file: unknown key(s): "foo"',
    ]);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(item => /unique id/i.test(item))).toBe(true);
  });
});
