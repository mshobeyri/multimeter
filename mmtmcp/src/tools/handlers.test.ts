import path from 'path';

import {
  handleDiscoverApi,
  handleReadDocumentation,
  handleValidate,
  handleRun,
} from './handlers';

describe('MCP handlers', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const workspaceRoot = repoRoot;

  it('read_documentation returns test docs', async () => {
    process.env.MMT_GUIDES_DIR = path.resolve(repoRoot, 'docs', 'AI');
    const result = await handleReadDocumentation({topic: 'test'});
    const payload = JSON.parse(result.content[0].text);
    expect(payload.topic).toBe('test');
    expect(payload.sections.length).toBeGreaterThan(0);
  });

  it('discover_api finds APIs in the repo examples', async () => {
    const result = await handleDiscoverApi({
      workspaceRoot: path.resolve(workspaceRoot, 'examples'),
    });
    const payload = JSON.parse(result.content[0].text);
    expect(payload.apiCount).toBeGreaterThan(0);
  });

  it('validate rejects invalid test content on disk', async () => {
    const file = 'examples/basic/02_simple_test/echo_test.mmt';
    const result = await handleValidate({
      file,
      workspaceRoot,
      expectedType: 'test',
    });
    const payload = JSON.parse(result.content[0].text);
    expect(payload.valid).toBe(true);
  });

  it('runs a local .mmt test via MCP handler', async () => {
    const file = 'examples/intermediate/14_javascript_helpers/js_test.mmt';
    const result = await handleRun({
      file,
      workspaceRoot,
      quiet: true,
    });
    const payload = JSON.parse(result.content[0].text);
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.logs)).toBe(true);
    expect(payload.errors).toEqual([]);
  });
});
