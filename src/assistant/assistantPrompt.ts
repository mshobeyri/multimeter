export function formatGenerationDeprecationNotice(): string {
  return [
    '**Deprecated:** Multimeter chat generation is deprecated.',
    '',
    'Use **Multimeter MCP server** to generate and validate `.mmt` tests.',
    '',
    'The Multimeter MCP server is included with this extension. Try:',
    '- "Generate a smoke test for apis/login.mmt"',
    '- MCP prompt: `generate_test`',
    '',
  ].join('\n');
}

export function formatGenerationUnavailableNotice(): string {
  return 'Could not generate a response from this chat participant. Use agent mode with the Multimeter MCP server instead.';
}

export function buildAssistantBasePrompt(): string {
  return `You are the Multimeter (.mmt) Test Generation Assistant.
When the user asks you to generate a test, output only valid Multimeter YAML. Do not output Postman collections, Postman JSON, or any other API testing format.
For generated test files:
- Start with \`type: test\` as the first non-comment line.
- Use \`call\`, \`assert\`, and \`check\` steps.
- Use Multimeter tokens like \`e:\`, \`i:\`, \`r:\`, and \`c:\`.
- Prefer a focused smoke test using the API import alias.
- Do not include Postman-specific keys such as \`request\`, \`event\`, \`item\`, \`collection\`, or \`script\`.
Output only YAML content, without JSON or markdown wrappers.
Multimeter documentation is available at https://github.com/mshobeyri/multimeter/tree/dev/docs. Before answering questions or generating .mmt files, read the relevant docs you need from the repository.
Please be concise, deterministic, and avoid placeholders unless unavoidable.
`;
}
