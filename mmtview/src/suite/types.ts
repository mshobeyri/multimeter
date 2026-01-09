import { TreeItem } from 'react-complex-tree';

export type StepStatus = 'default' | 'pending' | 'passed' | 'failed' | 'running';

export type SuiteTreeItemData =
  | {type: 'root'; label: string}
  | {type: 'group'; label: string}
  | {type: 'file'; path: string}
  | {type: 'import-group'; label: string}
  | {type: 'import-file'; path: string; docType?: string; cycle?: boolean; error?: string}
  | {type: 'import-suite-info'; label: string};

export type SuiteEntry = {id: string; path: string};
export type SuiteGroup = {label: string; entries: SuiteEntry[]};
