import { TreeItem } from 'react-complex-tree';

export type StepStatus = 'default' | 'pending' | 'passed' | 'failed';

export type SuiteTreeItemData =
  | {type: 'root'; label: string}
  | {type: 'group'; label: string}
  | {type: 'file'; path: string};

export type SuiteEntry = {id: string; path: string};
export type SuiteGroup = {label: string; entries: SuiteEntry[]};
