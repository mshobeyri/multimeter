import {
  filesForAgentDocTopic,
  formatAgentDocs,
  listAgentDocTopics,
  loadAgentDocSections,
} from './agentDocs';

describe('agentDocs', () => {
  it('lists the same topics for CLI and MCP (MCP omits offline)', () => {
    expect(listAgentDocTopics()).toEqual([
      'overview',
      'workflow',
      'test',
      'api',
      'loadtest',
      'suite',
      'env',
      'doc',
      'constraints',
      'all',
      'offline',
    ]);
    expect(listAgentDocTopics({offline: false})).not.toContain('offline');
  });

  it('maps min and full packs to the same guide files', () => {
    expect(filesForAgentDocTopic('test', 'min')).toEqual(['min/test.md']);
    expect(filesForAgentDocTopic('test', 'full')).toEqual(['generate-test.md']);
    expect(filesForAgentDocTopic('offline')).toEqual(['offline-agent.md']);
  });

  it('formats docs from an injected reader', () => {
    const text = formatAgentDocs({
      topic: 'test',
      pack: 'min',
      guidesDir: '/guides',
      readText: (fileName) => `# ${fileName}\nbody`,
    });
    expect(text).toContain('topic=test pack=min');
    expect(text).toContain('guidesDir: /guides');
    expect(text).toContain('<!-- min/test.md -->');
    expect(text).toContain('# min/test.md');
  });

  it('defaults topic and pack when omitted', () => {
    const loaded = loadAgentDocSections({
      readText: (fileName) => fileName,
    });
    expect(loaded.topic).toBe('overview');
    expect(loaded.pack).toBe('min');
    expect(loaded.sections.map(s => s.fileName)).toEqual(['min/overview.md']);
  });

  it('flattens unique files for topic all', () => {
    const files = filesForAgentDocTopic('all', 'min');
    expect(files).toContain('min/test.md');
    expect(files).toContain('min/overview.md');
    expect(new Set(files).size).toBe(files.length);
  });

  it('loads structured sections for MCP', () => {
    const loaded = loadAgentDocSections({
      topic: 'api',
      pack: 'full',
      readText: (fileName) => fileName,
    });
    expect(loaded.sections).toEqual([
      {fileName: 'generate-api.md', content: 'generate-api.md'},
    ]);
  });
});
