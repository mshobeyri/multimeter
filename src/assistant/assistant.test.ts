import {
  buildAssistantBasePrompt,
  formatGenerationDeprecationNotice,
  formatGenerationUnavailableNotice,
} from './assistantPrompt';

describe('Multimeter assistant base prompt', () => {
  it('requires generated tests to be valid Multimeter YAML and forbids Postman format', () => {
    const prompt = buildAssistantBasePrompt();
    expect(prompt).toContain('output only valid Multimeter YAML');
    expect(prompt).toContain('Start with `type: test` as the first non-comment line');
    expect(prompt).toContain('Use `call`, `assert`, and `check` steps');
    expect(prompt).toContain('Do not include Postman-specific keys such as `request`, `event`, `item`, `collection`, or `script`');
  });
});

describe('Multimeter assistant deprecation notice', () => {
  it('directs users to the Multimeter MCP server', () => {
    const notice = formatGenerationDeprecationNotice();
    expect(notice).toContain('Deprecated');
    expect(notice).toContain('Multimeter MCP server');
    expect(notice).toContain('generate_test');
    expect(notice).not.toMatch(/^>/m);
  });
});

describe('Multimeter assistant generation fallback', () => {
  it('points users to the MCP server without troubleshooting steps', () => {
    const notice = formatGenerationUnavailableNotice();
    expect(notice).toContain('Multimeter MCP server');
    expect(notice).not.toContain('Quick fixes');
  });
});
