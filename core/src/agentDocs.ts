export type AgentDocTopic =
    'overview'|'workflow'|'test'|'api'|'loadtest'|'suite'|'env'|'doc'|
    'constraints'|'all'|'offline';

export type AgentDocPack = 'min'|'full';

export const FULL_TOPIC_FILES:
    Record<Exclude<AgentDocTopic, 'all'|'offline'>, string[]> = {
      overview: ['agent-workflow.md', 'general.md', 'generate.md'],
      workflow: ['agent-workflow.md'],
      test: ['generate-test.md'],
      api: ['generate-api.md'],
      loadtest: ['generate-loadtest.md'],
      suite: ['generate-suite.md'],
      env: ['generate-env.md'],
      doc: ['generate-doc.md'],
      constraints: ['generate-test-skill.md'],
    };

export const MIN_TOPIC_FILES:
    Record<Exclude<AgentDocTopic, 'all'|'offline'>, string[]> = {
      overview: ['min/overview.md'],
      workflow: ['min/workflow.md'],
      test: ['min/test.md'],
      api: ['min/api.md'],
      loadtest: ['min/loadtest.md'],
      suite: ['min/suite.md'],
      env: ['min/env.md'],
      doc: ['min/doc.md'],
      constraints: ['min/constraints.md'],
    };

export const AGENT_DOC_FILE_TOPICS =
    Object.keys(MIN_TOPIC_FILES) as Array<Exclude<AgentDocTopic, 'all'|'offline'>>;

export function listAgentDocTopics(opts?: {offline?: boolean}): AgentDocTopic[] {
  const topics: AgentDocTopic[] = [...AGENT_DOC_FILE_TOPICS, 'all'];
  if (opts?.offline !== false) {
    topics.push('offline');
  }
  return topics;
}

export function filesForAgentDocTopic(
    topic: AgentDocTopic, pack: AgentDocPack = 'min'): string[] {
  if (topic === 'offline') {
    return ['offline-agent.md'];
  }
  const table = pack === 'full' ? FULL_TOPIC_FILES : MIN_TOPIC_FILES;
  if (topic === 'all') {
    return Array.from(new Set(Object.values(table).flat()));
  }
  return table[topic];
}

export interface AgentDocSection {
  fileName: string;
  content: string;
}

export function loadAgentDocSections(opts: {
  topic?: AgentDocTopic;
  pack?: AgentDocPack;
  readText: (fileName: string) => string;
}): {topic: AgentDocTopic; pack: AgentDocPack; sections: AgentDocSection[]} {
  const topic = opts.topic || 'overview';
  const pack = opts.pack || 'min';
  const files = filesForAgentDocTopic(topic, pack);
  return {
    topic,
    pack,
    sections: files.map(fileName => ({
      fileName,
      content: opts.readText(fileName),
    })),
  };
}

export function formatAgentDocs(opts: {
  topic?: AgentDocTopic;
  pack?: AgentDocPack;
  guidesDir: string;
  readText: (fileName: string) => string;
}): string {
  const loaded = loadAgentDocSections(opts);
  const parts = loaded.sections.map(
      section => `<!-- ${section.fileName} -->\n${section.content.trim()}\n`);
  return [
    `# Multimeter docs — topic=${loaded.topic} pack=${loaded.pack}`,
    `guidesDir: ${opts.guidesDir}`,
    '',
    ...parts,
  ].join('\n');
}
