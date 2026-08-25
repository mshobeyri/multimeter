import { yamlToMock, mockToYaml } from 'mmt-core/mockParsePack';
import { MockData } from 'mmt-core/MockData';

export function canonicalizeMockYaml(content: string): string {
  const mock = yamlToMock(content);
  return mock ? mockToYaml(mock, content) : content;
}

export function patchMockYaml(
    content: string,
    patch: Partial<MockData> | ((mock: MockData) => MockData)): string {
  const mock = yamlToMock(content);
  if (!mock) {
    return content;
  }
  const next = typeof patch === 'function' ? patch(mock) : { ...mock, ...patch };
  return mockToYaml(next, content);
}
