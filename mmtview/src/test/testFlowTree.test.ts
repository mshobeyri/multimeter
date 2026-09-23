import { flattenStagesToSteps, treeItemsToFlow } from './TestFlow';

describe('treeItemsToFlow', () => {
  it('emits repeat with numeric count and empty steps', () => {
    const items = {
      flow: { index: 'flow', children: ['repeat_0'] },
      repeat_0: {
        index: 'repeat_0',
        isFolder: true,
        children: [],
        data: JSON.stringify({
          type: 'repeat',
          data: { stepData: { repeat: 2, steps: [] } },
        }),
      },
    };
    expect(treeItemsToFlow(items, 'flow')).toEqual([{ repeat: 2, steps: [] }]);
  });

  it('emits repeat with duration string and nested steps', () => {
    const items = {
      flow: { index: 'flow', children: ['repeat_0'] },
      repeat_0: {
        index: 'repeat_0',
        isFolder: true,
        children: ['print_0'],
        data: JSON.stringify({
          type: 'repeat',
          data: { stepData: { repeat: '5s', steps: [] } },
        }),
      },
      print_0: {
        index: 'print_0',
        isFolder: false,
        children: [],
        data: JSON.stringify({
          type: 'print',
          data: { stepData: { print: 'tick' } },
        }),
      },
    };
    expect(treeItemsToFlow(items, 'flow')).toEqual([
      { repeat: '5s', steps: [{ print: 'tick' }] },
    ]);
  });

  it('flattens multiple stages into one steps list in order', () => {
    const stages = [
      { id: 'stage_1', steps: [{ print: 'a' }] },
      { id: 'stage_2', steps: [{ print: 'b' }, { delay: '1s' }] },
    ];
    expect(flattenStagesToSteps(stages)).toEqual([
      { print: 'a' },
      { print: 'b' },
      { delay: '1s' },
    ]);
  });

  it('flattens all steps from a multistage tree', () => {
    const items = {
      flow: { index: 'flow', children: ['flow_0', 'flow_1'] },
      flow_0: {
        index: 'flow_0',
        isFolder: true,
        children: ['print_0'],
        data: JSON.stringify({
          type: 'stage',
          data: { stepData: { id: 'stage_1', steps: [] } },
        }),
      },
      print_0: {
        index: 'print_0',
        isFolder: false,
        children: [],
        data: JSON.stringify({
          type: 'print',
          data: { stepData: { print: 'stage one' } },
        }),
      },
      flow_1: {
        index: 'flow_1',
        isFolder: true,
        children: ['print_1', 'print_2'],
        data: JSON.stringify({
          type: 'stage',
          data: { stepData: { id: 'stage_2', steps: [] } },
        }),
      },
      print_1: {
        index: 'print_1',
        isFolder: false,
        children: [],
        data: JSON.stringify({
          type: 'print',
          data: { stepData: { print: 'stage two a' } },
        }),
      },
      print_2: {
        index: 'print_2',
        isFolder: false,
        children: [],
        data: JSON.stringify({
          type: 'print',
          data: { stepData: { print: 'stage two b' } },
        }),
      },
    };
    expect(flattenStagesToSteps(treeItemsToFlow(items, 'flow'))).toEqual([
      { print: 'stage one' },
      { print: 'stage two a' },
      { print: 'stage two b' },
    ]);
  });

  it('emits for with empty steps array', () => {
    const items = {
      flow: { index: 'flow', children: ['for_0'] },
      for_0: {
        index: 'for_0',
        isFolder: true,
        children: [],
        data: JSON.stringify({
          type: 'for',
          data: { stepData: { for: 'i in list', steps: [] } },
        }),
      },
    };
    expect(treeItemsToFlow(items, 'flow')).toEqual([{ for: 'i in list', steps: [] }]);
  });
});
