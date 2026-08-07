import type { SuiteTreeNode } from './suiteHierarchy';
import {
  findHierarchyNodeById,
  fingerprintHierarchyByEntryId,
  fingerprintSuiteTreeNode,
  remapSuiteTargetId,
} from './suiteHierarchyFingerprint';

describe('suiteHierarchyFingerprint', () => {
  const treeA: SuiteTreeNode = {
    kind: 'suite',
    id: 'suite-node:0',
    path: 'suite.mmt',
    title: 'Root',
    children: [
      { kind: 'test', id: 'suite-node:0.0', path: 'a.mmt', title: 'A' },
      { kind: 'test', id: 'suite-node:0.1', path: 'b.mmt', title: 'B' },
    ],
  };

  const treeB: SuiteTreeNode = {
    kind: 'suite',
    id: 'suite-node:0',
    path: 'suite.mmt',
    title: 'Root',
    children: [
      { kind: 'test', id: 'suite-node:0.0', path: 'new.mmt', title: 'New' },
      { kind: 'test', id: 'suite-node:0.1', path: 'a.mmt', title: 'A' },
      { kind: 'test', id: 'suite-node:0.2', path: 'b.mmt', title: 'B' },
    ],
  };

  it('fingerprints equal trees the same', () => {
    expect(fingerprintSuiteTreeNode(treeA)).toBe(fingerprintSuiteTreeNode({ ...treeA, children: [...treeA.children] }));
    expect(fingerprintHierarchyByEntryId({ 'suite-node:0': treeA }))
      .toBe(fingerprintHierarchyByEntryId({ 'suite-node:0': treeA }));
  });

  it('changes fingerprint when nested structure changes', () => {
    expect(fingerprintHierarchyByEntryId({ 'suite-node:0': treeA }))
      .not.toBe(fingerprintHierarchyByEntryId({ 'suite-node:0': treeB }));
  });

  it('finds nodes by id', () => {
    expect(findHierarchyNodeById({ e: treeA }, 'suite-node:0.1')?.kind).toBe('test');
    expect(findHierarchyNodeById({ e: treeA }, 'missing')).toBeNull();
  });

  it('remaps stale target ids by path after hierarchy shifts', () => {
    const previous = { e: treeA };
    const next = { e: treeB };
    // Old suite-node:0.0 was a.mmt; after insert it moved to suite-node:0.1
    expect(remapSuiteTargetId('suite-node:0.0', previous, next)).toBe('suite-node:0.1');
    expect(remapSuiteTargetId('suite-node:0.1', previous, next)).toBe('suite-node:0.2');
    // Still present unchanged
    expect(remapSuiteTargetId('suite-node:0', previous, next)).toBe('suite-node:0');
  });
});
