import {
  applyDescriptionBlockLiteralStyles,
  preserveMultilineDescriptionScalars,
} from './multilineDescriptionYaml';
import * as YAML from 'yaml';

describe('multilineDescriptionYaml', () => {
  it('preserves folded multiline description values as literal newlines', () => {
    const input = `type: api
description: Send a JSON payload to an echo endpoint and verify that the server
  returns it back.
url: https://test.mmt.dev/echo
`;
    const doc = YAML.parseDocument(input);
    preserveMultilineDescriptionScalars(doc.contents, input);
    const parsed = doc.toJS();
    expect(parsed.description).toBe(
        'Send a JSON payload to an echo endpoint and verify that the server\nreturns it back.',
    );
  });

  it('preserves multiline descriptions when the source uses CRLF', () => {
    const input = [
      'type: api',
      'description: Send a JSON payload to an echo endpoint and verify that the server',
      '  returns it back.',
      'url: https://test.mmt.dev/echo',
      '',
    ].join('\r\n');
    const doc = YAML.parseDocument(input);
    preserveMultilineDescriptionScalars(doc.contents, input);
    const parsed = doc.toJS();
    expect(parsed.description).toBe(
        'Send a JSON payload to an echo endpoint and verify that the server\nreturns it back.',
    );
    expect(parsed.description).not.toContain('\r');
  });

  it('serializes multiline descriptions with a block literal indicator', () => {
    const obj = {
      type: 'api',
      description: 'line one\nline two',
      url: 'https://example.com',
    };
    const doc = new YAML.Document();
    doc.contents = doc.createNode(obj);
    applyDescriptionBlockLiteralStyles(doc.contents);
    const yaml = doc.toString({lineWidth: 0});
    expect(yaml).toContain('description: |-');
    expect(yaml).toContain('  line one');
    expect(yaml).toContain('  line two');
  });
});
