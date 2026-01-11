export type SuiteTreeNode =
  | { kind: 'group'; id: string; label: string; children: SuiteTreeNode[] }
  | { kind: 'suite'; id: string; path: string; children: SuiteTreeNode[] }
  | { kind: 'test'; id: string; path: string }
  | { kind: 'missing'; id: string; path: string }
  | { kind: 'cycle'; id: string; path: string };
