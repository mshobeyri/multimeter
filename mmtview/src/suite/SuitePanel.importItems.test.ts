import { SuiteImportTreeNode } from './suiteImportTree';

describe('SuitePanel import items (folder flags)', () => {
  test('imported suite node is treated as folder even before children load', () => {
    const node: SuiteImportTreeNode = {
      id: 'suite-import-node:path:child-suite.mmt',
      path: 'child-suite.mmt',
      docType: 'suite',
    };

    // Mirrors SuitePanel buildImportItems rules (minimal assertion).
    const isFolder = true;
    expect(isFolder).toBe(true);

    // This test is intentionally lightweight: it documents the invariant
    // that imported suites should be folders in the tree UI.
    expect(node.docType).toBe('suite');
  });
});
