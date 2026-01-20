import {StepStatus} from '../shared/types';

export type SuiteTreeItemData =|{
  type: 'root';
  label: string
}
|{
  type: 'group';
  label: string
}
|{
  type: 'file';
  path: string
}
|{
  type: 'import-group';
  label: string
}
|{
  type: 'import-file';
  path: string;
  docType?: string;
  cycle?: boolean;
  error?: string
}
|{
  type: 'import-suite-info';
  label: string
};

export type SuiteEntry = {
  id: string; path: string
};
export type SuiteGroup = {
  label: string; entries: SuiteEntry[]
};
export type{StepStatus};