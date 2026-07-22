import { createSuiteNodeId } from 'mmt-core/suiteNodeId';
import {
  ownRunStatus,
  isUnderSuiteTarget,
  collectHierarchyNodeIds,
  buildFullSuitePendingState,
  buildTargetPendingState,
} from './suiteRunStatus';
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
