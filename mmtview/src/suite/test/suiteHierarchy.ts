export type SuiteTreeNode =
  | { kind: 'group'; label: string; children: SuiteTreeNode[] }
  | { kind: 'suite'; path: string; children: SuiteTreeNode[] }
  | { kind: 'test'; path: string }
  | { kind: 'missing'; path: string }
  | { kind: 'cycle'; path: string };
