import { formatMmtYaml } from './mmtFormat';
import { testToYaml, yamlToTest } from './testParsePack';

describe('yamlBlockSteps', () => {
  it('packs nested step lists as block sequences, not flow arrays', () => {
    const yaml = testToYaml({
      type: 'test',
      title: 'Flow',
      stages: [{
        id: 'stage_1',
        steps: [
          { run: '' },
          { if: '1 != 1', steps: [] },
          { for: '', steps: [] },
          { repeat: 2, steps: [] },
        ],
      }],
    } as any);

    expect(yaml).not.toMatch(/\[\s*\{/);
    expect(yaml).toContain('- run:');
    expect(yaml).toContain('- if:');
    expect(yaml).toContain('- for:');
    expect(yaml).toContain('- repeat:');
    expect(yaml).not.toMatch(/steps:\s*\n\s*\[\]/);
    expect(yaml).toMatch(/- for: ""\n(?:(?!steps:).)*$/m);
  });

  it('converts existing flow-style step arrays when formatting', () => {
    const flowYaml = `type: test
title: Flow
stages:
  - id: stage_1
    steps: [ { run: "" }, { if: 1 != 1, steps: [] }, { repeat: 2, steps: [] } ]
`;
    const { formatted } = formatMmtYaml(flowYaml, 'test.mmt');
    expect(formatted).not.toMatch(/\[\s*\{/);
    expect(formatted).toContain('- run:');
    expect(formatted).not.toContain('- { run:');
    expect(yamlToTest(formatted).stages?.[0]?.steps?.length).toBe(3);
  });

  it('preserves block-style lists when flow editor adds a step', () => {
    const original = `type: test
title: Flow
stages:
  - id: stage_1
    steps:
      - for: ""
        steps: []
`;
    const test = yamlToTest(original);
    test.stages![0].steps!.push({ print: 'added' } as any);
    const merged = testToYaml(test, original);
    expect(merged).not.toMatch(/\[\s*\{/);
    expect(merged).toContain('- print: added');
    expect(merged).toContain('- for:');
  });
});
