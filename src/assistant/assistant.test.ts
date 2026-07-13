import {buildAssistantBasePrompt} from './assistantPrompt';

describe('Multimeter assistant base prompt', () => {
  it('requires generated tests to be valid Multimeter YAML and forbids Postman format', () => {
    const prompt = buildAssistantBasePrompt();
    expect(prompt).toContain('output only valid Multimeter YAML');
    expect(prompt).toContain('Start with `type: test` as the first non-comment line');
    expect(prompt).toContain('Use `call`, `assert`, and `check` steps');
    expect(prompt).toContain('Do not include Postman-specific keys such as `request`, `event`, `item`, `collection`, or `script`');
  });
});
