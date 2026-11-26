import { createSuiteNodeId } from 'mmt-core/suite/suiteNodeId';
import {
  ownRunStatus,
  isUnderSuiteTarget,
  collectHierarchyNodeIds,
  buildFullSuitePendingState,
  buildTargetPendingState,
  rollupRunStatus,
  rollupAncestorRunStatus,
} from './suiteRunStatus';
import type { StepStatus } from '../../shared/types';
import type { SuiteTreeNode } from './suiteHierarchy';

describe('suiteRunStatus helpers', () => {
  it('allows all ids when there is no partial target', () => {
    expect(isUnderSuiteTarget(null, 'suite-node:1.0')).toBe(true);
    expect(isUnderSuiteTarget(undefined, 'anything')).toBe(true);
  });

  it('matches target and descendants by prefix', () => {
    expect(isUnderSuiteTarget('suite-node:1.1', 'suite-node:1.1')).toBe(true);
    expect(isUnderSuiteTarget('suite-node:1.1', 'suite-node:1.1.0.0')).toBe(true);
    expect(isUnderSuiteTarget('suite-node:1.1', 'suite-node:1.0')).toBe(false);
    expect(isUnderSuiteTarget('suite-node:1.1', 'suite-node:1.10')).toBe(false);
    expect(isUnderSuiteTarget('suite-node:1.1', null)).toBe(false);
  });

  it('reads own run status by id', () => {
    expect(ownRunStatus({ 'suite-node:1.0': 'failed' }, 'suite-node:1.0')).toBe('failed');
    expect(ownRunStatus({ 'suite-node:1.0': 'failed' }, 'suite-node:1.1')).toBe('default');
    expect(ownRunStatus({}, undefined)).toBe('default');
  });

  it('collects hierarchy node ids including nested children', () => {
    const root: SuiteTreeNode = {
      kind: 'suite',
      id: 'suite-node:1.0',
      path: 'child.mmt',
      children: [
        { kind: 'test', id: 'suite-node:1.0.0', path: 'a.mmt' },
        {
          kind: 'group',
          id: 'suite-node:1.0.1',
          label: 'g',
          children: [{ kind: 'test', id: 'suite-node:1.0.1.0', path: 'b.mmt' }],
        },
      ],
    };
    expect(collectHierarchyNodeIds(root).sort()).toEqual([
      'suite-node:1.0',
      'suite-node:1.0.0',
      'suite-node:1.0.1',
      'suite-node:1.0.1.0',
    ].sort());
  });

  it('builds full-suite pending for groups, entries, and hierarchy descendants', () => {
    const hierarchy: Record<string, SuiteTreeNode> = {
      'suite-node:1.0': {
        kind: 'suite',
        id: 'suite-node:1.0',
        path: 'nested.mmt',
        children: [{ kind: 'test', id: 'suite-node:1.0.0', path: 't.mmt' }],
      },
    };
    const pending = buildFullSuitePendingState(
      [{ label: '', entries: [{ path: 'nested.mmt', id: 'suite-node:1.0' }] }],
      hierarchy,
    );
    expect(pending[createSuiteNodeId([0])]).toBe('pending');
    expect(pending['suite-node:1.0']).toBe('pending');
    expect(pending['suite-node:1.0.0']).toBe('pending');
  });

  it('does not mark mock server items as pending', () => {
    const hierarchy: Record<string, SuiteTreeNode> = {
      'suite-node:0.0': {
        kind: 'suite',
        id: 'suite-node:0.0',
        path: 'nested.mmt',
        children: [
          { kind: 'server', id: 'suite-node:0.0.-1.0', path: 'mock.mmt', title: 'User mock' },
          { kind: 'test', id: 'suite-node:0.0.0', path: 't.mmt' },
        ],
      },
      'suite-node:0.1': {
        kind: 'server',
        id: 'suite-node:0.1',
        path: 'top-mock.mmt',
        title: 'Auth mock',
      },
    };
    const groups = [
      {
        label: 'Group 1',
        entries: [
          { path: 'nested.mmt', id: 'suite-node:0.0' },
          { path: 'top-mock.mmt', id: 'suite-node:0.1' },
        ],
      },
    ];
    const pending = buildFullSuitePendingState(groups, hierarchy);
    expect(pending[createSuiteNodeId([0])]).toBe('pending');
    expect(pending['suite-node:0.0']).toBe('pending');
    expect(pending['suite-node:0.0.0']).toBe('pending');
    expect(pending['suite-node:0.0.-1.0']).toBeUndefined();
    expect(pending['suite-node:0.1']).toBeUndefined();
  });

  it('builds target pending for group targets including entry descendants', () => {
    const hierarchy: Record<string, SuiteTreeNode> = {
      'suite-node:0.0': {
        kind: 'suite',
        id: 'suite-node:0.0',
        path: 'nested.mmt',
        children: [{ kind: 'test', id: 'suite-node:0.0.0', path: 't.mmt' }],
      },
      'suite-node:0.1': {
        kind: 'test',
        id: 'suite-node:0.1',
        path: 'other.mmt',
      },
      'suite-node:1.0': {
        kind: 'test',
        id: 'suite-node:1.0',
        path: 'other-group.mmt',
      },
    };
    const groups = [
      {
        label: 'Group 1',
        entries: [
          { path: 'nested.mmt', id: 'suite-node:0.0' },
          { path: 'other.mmt', id: 'suite-node:0.1' },
        ],
      },
      {
        label: 'Group 2',
        entries: [{ path: 'other-group.mmt', id: 'suite-node:1.0' }],
      },
    ];
    const pending = buildTargetPendingState('suite-node:0', groups, hierarchy);
    expect(pending).toEqual({
      'suite-node:0': 'pending',
      'suite-node:0.0': 'pending',
      'suite-node:0.0.0': 'pending',
      'suite-node:0.1': 'pending',
    });
    expect(pending['suite-node:1.0']).toBeUndefined();
  });

  it('builds target pending for nested targets without marking ancestors', () => {
    const hierarchy: Record<string, SuiteTreeNode> = {
      'suite-node:0.0': {
        kind: 'suite',
        id: 'suite-node:0.0',
        path: 'nested.mmt',
        children: [
          {
            kind: 'group',
            id: 'suite-node:0.0.1',
            label: 'g',
            children: [{ kind: 'test', id: 'suite-node:0.0.1.0', path: 't.mmt' }],
          },
        ],
      },
    };
    const groups = [
      { label: 'Group 1', entries: [{ path: 'nested.mmt', id: 'suite-node:0.0' }] },
    ];
    const pending = buildTargetPendingState('suite-node:0.0.1', groups, hierarchy);
    expect(pending).toEqual({
      'suite-node:0.0.1': 'pending',
      'suite-node:0.0.1.0': 'pending',
    });
    expect(pending['suite-node:0.0']).toBeUndefined();
    expect(buildTargetPendingState('missing', groups, hierarchy)).toEqual({ missing: 'pending' });
  });
});

describe('rollupRunStatus', () => {
  it('uses worst-wins: failed > invalid > passed > skipped', () => {
    expect(rollupRunStatus(['passed', 'failed', 'invalid'])).toBe('failed');
    expect(rollupRunStatus(['passed', 'invalid', 'skipped'])).toBe('invalid');
    expect(rollupRunStatus(['passed', 'skipped'])).toBe('passed');
    expect(rollupRunStatus(['skipped', 'skipped'])).toBe('skipped');
  });

  it('keeps live and unknown states visible', () => {
    expect(rollupRunStatus(['passed', 'running'])).toBe('running');
    expect(rollupRunStatus(['failed', 'running'])).toBe('running');
    expect(rollupRunStatus(['passed', 'cancelled'])).toBe('cancelled');
    expect(rollupRunStatus(['passed', 'pending'])).toBe('pending');
  });

  it('stays unknown when a child never ran, unless a sibling already failed', () => {
    expect(rollupRunStatus(['passed', 'default'])).toBe('default');
    expect(rollupRunStatus(['skipped', 'default'])).toBe('default');
    expect(rollupRunStatus(['failed', 'default'])).toBe('failed');
    expect(rollupRunStatus(['invalid', 'default'])).toBe('invalid');
  });

  it('returns default for no children', () => {
    expect(rollupRunStatus([])).toBe('default');
  });
});

describe('rollupAncestorRunStatus', () => {
  // group 0
  //   entry suite-node:0.0 (suite)
  //     suite-node:0.0.0 test a
  //     suite-node:0.0.1 group g
  //       suite-node:0.0.1.0 test b
  //       suite-node:0.0.1.1 test c
  //   entry suite-node:0.1 test d
  const hierarchy: Record<string, SuiteTreeNode> = {
    'suite-node:0.0': {
      kind: 'suite',
      id: 'suite-node:0.0',
      path: 'nested.mmt',
      children: [
        { kind: 'test', id: 'suite-node:0.0.0', path: 'a.mmt' },
        {
          kind: 'group',
          id: 'suite-node:0.0.1',
          label: 'g',
          children: [
            { kind: 'test', id: 'suite-node:0.0.1.0', path: 'b.mmt' },
            { kind: 'test', id: 'suite-node:0.0.1.1', path: 'c.mmt' },
          ],
        },
      ],
    },
    'suite-node:0.1': { kind: 'test', id: 'suite-node:0.1', path: 'd.mmt' },
  };
  const groups = [
    {
      label: 'Group 1',
      entries: [
        { path: 'nested.mmt', id: 'suite-node:0.0' },
        { path: 'd.mmt', id: 'suite-node:0.1' },
      ],
    },
  ];

  const apply = (
    state: Record<string, StepStatus>,
    target: string,
  ): Record<string, StepStatus> => ({
    ...state,
    ...rollupAncestorRunStatus(state, target, groups, hierarchy),
  });

  it('clears a stale failed parent chain once the re-run leaf passes', () => {
    // Full run: c failed, so the group, the suite entry and the top group failed.
    const afterFullRun: Record<string, StepStatus> = {
      'suite-node:0': 'failed',
      'suite-node:0.0': 'failed',
      'suite-node:0.0.0': 'passed',
      'suite-node:0.0.1': 'failed',
      'suite-node:0.0.1.0': 'passed',
      'suite-node:0.0.1.1': 'failed',
      'suite-node:0.1': 'passed',
    };
    // User re-runs c alone and it passes.
    const afterRerun = apply({ ...afterFullRun, 'suite-node:0.0.1.1': 'passed' }, 'suite-node:0.0.1.1');

    expect(afterRerun['suite-node:0.0.1']).toBe('passed');
    expect(afterRerun['suite-node:0.0']).toBe('passed');
    expect(afterRerun['suite-node:0']).toBe('passed');
  });

  it('keeps ancestors failed while another child is still failed', () => {
    const state: Record<string, StepStatus> = {
      'suite-node:0': 'failed',
      'suite-node:0.0': 'failed',
      'suite-node:0.0.0': 'failed',
      'suite-node:0.0.1': 'failed',
      'suite-node:0.0.1.0': 'passed',
      'suite-node:0.0.1.1': 'passed',
      'suite-node:0.1': 'passed',
    };
    const next = apply(state, 'suite-node:0.0.1.1');

    // g is now all passed, but test a (sibling of g) is still failed.
    expect(next['suite-node:0.0.1']).toBe('passed');
    expect(next['suite-node:0.0']).toBe('failed');
    expect(next['suite-node:0']).toBe('failed');
  });

  it('turns a passed parent failed when a re-run leaf fails', () => {
    const state: Record<string, StepStatus> = {
      'suite-node:0': 'passed',
      'suite-node:0.0': 'passed',
      'suite-node:0.0.0': 'passed',
      'suite-node:0.0.1': 'passed',
      'suite-node:0.0.1.0': 'passed',
      'suite-node:0.0.1.1': 'failed',
      'suite-node:0.1': 'passed',
    };
    const next = apply(state, 'suite-node:0.0.1.1');
    expect(next['suite-node:0.0.1']).toBe('failed');
    expect(next['suite-node:0.0']).toBe('failed');
    expect(next['suite-node:0']).toBe('failed');
  });

  it('does not invent a passed parent when siblings never ran', () => {
    const state: Record<string, StepStatus> = {
      'suite-node:0.0.1.1': 'passed',
    };
    const patches = rollupAncestorRunStatus(state, 'suite-node:0.0.1.1', groups, hierarchy);
    expect(patches).toEqual({});
  });

  it('only touches ancestors, never the target or its descendants', () => {
    const state: Record<string, StepStatus> = {
      'suite-node:0': 'failed',
      'suite-node:0.0': 'failed',
      'suite-node:0.0.0': 'passed',
      'suite-node:0.0.1': 'passed',
      'suite-node:0.0.1.0': 'failed',
      'suite-node:0.0.1.1': 'passed',
      'suite-node:0.1': 'passed',
    };
    // The target's own state comes from core. Even though its child b says
    // failed here, the rollup must not rewrite the target or its descendants;
    // it only recomputes the ancestors from the target's own state.
    const patches = rollupAncestorRunStatus(state, 'suite-node:0.0.1', groups, hierarchy);
    expect(patches).toEqual({
      'suite-node:0.0': 'passed',
      'suite-node:0': 'passed',
    });
  });

  it('rolls a group target up to its entry and top group', () => {
    const state: Record<string, StepStatus> = {
      'suite-node:0': 'failed',
      'suite-node:0.0': 'failed',
      'suite-node:0.0.0': 'passed',
      'suite-node:0.0.1': 'passed',
      'suite-node:0.1': 'passed',
    };
    const next = apply(state, 'suite-node:0.0.1');
    expect(next['suite-node:0.0']).toBe('passed');
    expect(next['suite-node:0']).toBe('passed');
  });

  it('rolls a top-level entry up to its group', () => {
    const state: Record<string, StepStatus> = {
      'suite-node:0': 'failed',
      'suite-node:0.0': 'passed',
      'suite-node:0.1': 'passed',
    };
    const next = apply(state, 'suite-node:0.1');
    expect(next['suite-node:0']).toBe('passed');
  });

  it('ignores mock servers when rolling up', () => {
    const withServer: Record<string, SuiteTreeNode> = {
      'suite-node:0.0': {
        kind: 'suite',
        id: 'suite-node:0.0',
        path: 'nested.mmt',
        serverItems: [{ kind: 'server', id: 'suite-node:0.0.-1.0', path: 'mock.mmt' }],
        children: [{ kind: 'test', id: 'suite-node:0.0.0', path: 'a.mmt' }],
      } as SuiteTreeNode,
    };
    const g = [{ label: 'G', entries: [{ path: 'nested.mmt', id: 'suite-node:0.0' }] }];
    const patches = rollupAncestorRunStatus(
      { 'suite-node:0': 'failed', 'suite-node:0.0': 'failed', 'suite-node:0.0.0': 'passed' },
      'suite-node:0.0.0',
      g,
      withServer,
    );
    expect(patches).toEqual({ 'suite-node:0.0': 'passed', 'suite-node:0': 'passed' });
  });

  it('returns nothing for an unknown target or no target', () => {
    const state: Record<string, StepStatus> = { 'suite-node:0': 'failed' };
    expect(rollupAncestorRunStatus(state, 'suite-node:9.9', groups, hierarchy)).toEqual({});
    expect(rollupAncestorRunStatus(state, null, groups, hierarchy)).toEqual({});
    expect(rollupAncestorRunStatus(state, undefined, groups, hierarchy)).toEqual({});
  });
});
