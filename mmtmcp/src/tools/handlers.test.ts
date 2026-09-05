import path from 'path';

import {
  handleApiCard,
  handleDiscoverApi,
  handleReadDocumentation,
  handleScaffoldTest,
  handleValidate,
  handleRun,
} from './handlers';

describe('MCP handlers', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const workspaceRoot = repoRoot;

  it('read_documentation defaults to min pack', async () => {
    process.env.MMT_GUIDES_DIR = path.resolve(repoRoot, 'docs', 'AI');
    const result = await handleReadDocumentation({topic: 'test'});
    const payload = JSON.parse(result.content[0].text);
    expect(payload.topic).toBe('test');
    expect(payload.pack).toBe('min');
    expect(payload.sections[0].fileName).toBe('min/test.md');
    expect(payload.sections[0].content.length).toBeLessThan(4000);
  });

  it('read_documentation full pack returns generate-test.md', async () => {
    process.env.MMT_GUIDES_DIR = path.resolve(repoRoot, 'docs', 'AI');
    const result = await handleReadDocumentation({topic: 'test', pack: 'full'});
    const payload = JSON.parse(result.content[0].text);
    expect(payload.pack).toBe('full');
    expect(payload.sections[0].fileName).toBe('generate-test.md');
  });

  it('discover_api finds APIs in the repo examples', async () => {
    const result = await handleDiscoverApi({
      workspaceRoot: path.resolve(workspaceRoot, 'examples'),
    });
    const payload = JSON.parse(result.content[0].text);
    expect(payload.apiCount).toBeGreaterThan(0);
  });

  it('api_card returns compact summary without full content', async () => {
    const apiPath = 'examples/basic/01_simple_api/get_json.mmt';
    const result = await handleApiCard({workspaceRoot, apiPath});
    const payload = JSON.parse(result.content[0].text);
    expect(payload.filePath).toContain('get_json.mmt');
    expect(payload.method || payload.url).toBeTruthy();
    expect(payload.content).toBeUndefined();
    expect(payload.suggestedTestPath).toBeTruthy();
  });

  it('discover_api selectedApi omits content by default', async () => {
    const apiPath = 'examples/basic/01_simple_api/get_json.mmt';
    const result = await handleDiscoverApi({workspaceRoot, apiPath});
    const payload = JSON.parse(result.content[0].text);
    expect(payload.selectedApi.content).toBeUndefined();
    expect(payload.selectedApi.filePath).toContain('get_json.mmt');
  });

  it('scaffold_test returns valid smoke YAML from an example API', async () => {
    const apiPath = 'examples/basic/01_simple_api/get_json.mmt';
    const result = await handleScaffoldTest({
      workspaceRoot,
      apiPath,
      strategy: 'smoke',
    });
    const payload = JSON.parse(result.content[0].text);
    expect(payload.yaml).toMatch(/^type:\s*test/m);
    expect(payload.validation.valid).toBe(true);
    expect(payload.suggestedPath).toContain('smoke');
    expect(payload.apiCard.filePath).toContain('get_json.mmt');
    expect(payload.alias).toBeTruthy();
    expect(payload.importPath).toBeTruthy();
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
