import React from 'react';
import { TreeItem } from 'react-complex-tree';
import SuiteTestTree, { type SuiteTestTreeHandle, type SuiteTestTreeItemData } from './SuiteTestTree';
import type { SuiteGroup } from '../types';
import type { SuiteTreeNode } from './suiteHierarchy';
import type { StepStatus } from '../../shared/types';
import type { ReportStatusFilter } from '../../shared/reportStatusFilter';
import { SuiteRunDataStore, useSuiteRunTreeVersion } from './suiteRunDataStore';

type SuiteTestTreePanelProps = {
  store: SuiteRunDataStore;
  groups: SuiteGroup[];
  hierarchyByEntryId: Record<string, SuiteTreeNode>;
  missingFiles: Set<string>;
  statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };
  statusFilter?: ReportStatusFilter;
  duplicateServerIds?: Set<string>;
  onStatusFilterChange?: (next: ReportStatusFilter) => void;
  onRunTargets: (target: string) => void | Promise<void>;
  onRunTargetsInCore?: (target: string) => void | Promise<void>;
  onRequestHierarchy?: (entryId: string) => void;
  suiteStructureKey?: string;
  onExpandedItemsChange?: (
    expandedItems: string[],
    items: Record<string, TreeItem<SuiteTestTreeItemData>>,
  ) => void;
  onRequestReports?: (nodeId: string) => void;
};

const SuiteTestTreePanel = React.forwardRef<SuiteTestTreeHandle, SuiteTestTreePanelProps>(
  function SuiteTestTreePanel({
    store,
    ...props
  }, ref) {
    useSuiteRunTreeVersion(store);

    return (
      <SuiteTestTree
        ref={ref}
        {...props}
        reportsById={store.getReportsById()}
        runStateById={store.getRunStateById()}
        spilledReportIds={store.getSpilledReportIds()}
        loadingReportIds={store.getLoadingReportIds()}
      />
    );
  },
);

export default React.memo(SuiteTestTreePanel);
