export type SuiteImportDocType = 'suite' | 'test' | 'api' | 'env' | 'doc' | 'unknown' | 'missing';

export type SuiteImportTreeNode = {
  id: string;
  path: string;
  docType: SuiteImportDocType;
  cycle?: boolean;
  error?: string;
  children?: SuiteImportTreeNode[];
  // Only on suite nodes.
  tests?: string[];
};

export type SuiteImportTreeResult = {
  results: Record<string, { path: string; docType: SuiteImportDocType; tests?: string[]; cycle?: boolean; error?: string }>;
};

let nodeSuffix = 0;
const nextNodeId = () => `suite-import-node-${nodeSuffix++}`;

export const createNode = (path: string, docType: SuiteImportDocType): SuiteImportTreeNode => ({
  id: nextNodeId(),
  path,
  docType,
});
