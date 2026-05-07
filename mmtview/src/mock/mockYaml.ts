import { yamlToMock, mockToYaml } from 'mmt-core/mockParsePack';

export function canonicalizeMockYaml(content: string): string {
  const mock = yamlToMock(content);
  return mock ? mockToYaml(mock) : content;
}