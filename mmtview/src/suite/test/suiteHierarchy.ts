export type SuiteTreeNode =
  | { kind: 'group'; label: string; children: SuiteTreeNode[] }
  | { kind: 'suite'; path: string; leafId?: string; children: SuiteTreeNode[] }
  | { kind: 'test'; path: string; leafId?: string }
  | { kind: 'missing'; path: string }
  | { kind: 'cycle'; path: string };
