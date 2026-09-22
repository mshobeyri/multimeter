import { useSyncExternalStore } from 'react';
import { StepStatus } from '../../shared/types';
import { StepReportItem } from '../../shared/TestStepReportPanel';
import { computeReportStats, type ReportStepStats } from '../../shared/reportSpillLogic';
import { resetLeafStateMap } from './leafStateReset';

export type SuiteRunOverview = {
  passed: number;
  failed: number;
  skipped: number;
  fileCount: number;
  hasReportData: boolean;
  hasRunState: boolean;
};

const EMPTY_OVERVIEW: SuiteRunOverview = {
  passed: 0,
  failed: 0,
  skipped: 0,
  fileCount: 0,
  hasReportData: false,
  hasRunState: false,
};

function countSkipped(runStateById: Record<string, StepStatus>): number {
  let skipped = 0;
  for (const status of Object.values(runStateById)) {
    if (status === 'skipped') {
      skipped += 1;
    }
  }
  return skipped;
}

function nodeHasReportData(
  id: string,
  reportsById: Record<string, StepReportItem[]>,
  statsById: Record<string, ReportStepStats>,
  spilled: Set<string>,
): boolean {
  if (reportsById[id]?.length) {
    return true;
  }
  if (spilled.has(id) && (statsById[id]?.stepCount ?? 0) > 0) {
    return true;
  }
  return (statsById[id]?.stepCount ?? 0) > 0;
}

export class SuiteRunDataStore {
  private leafReportsById: Record<string, StepReportItem[]> = {};
  private leafRunStateById: Record<string, StepStatus> = {};
  private reportStatsById: Record<string, ReportStepStats> = {};
  private spilledReportIds = new Set<string>();
  private loadingReportIds = new Set<string>();
  private overview: SuiteRunOverview = { ...EMPTY_OVERVIEW };
  private treeVersion = 0;
  private overviewVersion = 0;
  private treeListeners = new Set<() => void>();
  private overviewListeners = new Set<() => void>();

  subscribeTree = (listener: () => void): (() => void) => {
    this.treeListeners.add(listener);
    return () => {
      this.treeListeners.delete(listener);
    };
  };

  subscribeOverview = (listener: () => void): (() => void) => {
    this.overviewListeners.add(listener);
    return () => {
      this.overviewListeners.delete(listener);
    };
  };

  getTreeVersion = (): number => {
    return this.treeVersion;
  };

  getOverview = (): SuiteRunOverview => {
    return this.overview;
  };

  getReportsById(): Record<string, StepReportItem[]> {
    return this.leafReportsById;
  }

  getRunStateById(): Record<string, StepStatus> {
    return this.leafRunStateById;
  }

  getReportStatsById(): Record<string, ReportStepStats> {
    return this.reportStatsById;
  }

  getSpilledReportIds(): Set<string> {
    return this.spilledReportIds;
  }

  getLoadingReportIds(): Set<string> {
    return this.loadingReportIds;
  }

  private bumpTree(): void {
    this.treeVersion += 1;
    this.treeListeners.forEach((listener) => {
      listener();
    });
  }

  private overviewEquals(a: SuiteRunOverview, b: SuiteRunOverview): boolean {
    return a.passed === b.passed &&
      a.failed === b.failed &&
      a.skipped === b.skipped &&
      a.fileCount === b.fileCount &&
      a.hasReportData === b.hasReportData &&
      a.hasRunState === b.hasRunState;
  }

  private bumpOverview(next: SuiteRunOverview): void {
    if (this.overviewEquals(this.overview, next)) {
      return;
    }
    this.overview = next;
    this.overviewVersion += 1;
    this.overviewListeners.forEach((listener) => {
      listener();
    });
  }

  private syncOverviewFlags(): void {
    const hasReportData =
      this.spilledReportIds.size > 0 ||
      Object.keys(this.reportStatsById).length > 0 ||
      Object.values(this.leafReportsById).some((reports) => reports.length > 0);
    const hasRunState = Object.keys(this.leafRunStateById).length > 0;
    if (
      this.overview.hasReportData === hasReportData &&
      this.overview.hasRunState === hasRunState
    ) {
      return;
    }
    this.bumpOverview({
      ...this.overview,
      hasReportData,
      hasRunState,
    });
  }

  private recomputeOverviewCounts(): void {
    let passed = 0;
    let failed = 0;
    let fileCount = 0;
    const countedStats = new Set<string>();

    for (const [id, reports] of Object.entries(this.leafReportsById)) {
      if (this.spilledReportIds.has(id)) {
        const stats = this.reportStatsById[id];
        if (stats) {
          passed += stats.passed;
          failed += stats.failed;
          fileCount += 1;
          countedStats.add(id);
        }
        continue;
      }
      if (reports.length > 0) {
        fileCount += 1;
      }
      for (const report of reports) {
        if (report.status === 'failed') {
          failed += 1;
        } else {
          passed += 1;
        }
      }
    }

    for (const [id, stats] of Object.entries(this.reportStatsById)) {
      if (countedStats.has(id)) {
        continue;
      }
      if (!this.leafReportsById[id]?.length && stats.stepCount > 0) {
        passed += stats.passed;
        failed += stats.failed;
        fileCount += 1;
      }
    }

    this.bumpOverview({
      passed,
      failed,
      skipped: countSkipped(this.leafRunStateById),
      fileCount,
      hasReportData:
        fileCount > 0 ||
        this.spilledReportIds.size > 0 ||
        Object.keys(this.reportStatsById).length > 0,
      hasRunState: Object.keys(this.leafRunStateById).length > 0,
    });
  }

  resetReportsAndSpill(): void {
    this.leafReportsById = {};
    this.reportStatsById = {};
    this.spilledReportIds = new Set();
    this.loadingReportIds = new Set();
    this.recomputeOverviewCounts();
    this.bumpTree();
  }

  resetAll(): void {
    this.leafReportsById = {};
    this.leafRunStateById = {};
    this.reportStatsById = {};
    this.spilledReportIds = new Set();
    this.loadingReportIds = new Set();
    this.bumpOverview({ ...EMPTY_OVERVIEW });
    this.bumpTree();
  }

  resetPartial(targets: readonly string[]): void {
    this.leafReportsById = resetLeafStateMap(this.leafReportsById, targets);
    this.leafRunStateById = resetLeafStateMap(this.leafRunStateById, targets);
    this.reportStatsById = resetLeafStateMap(this.reportStatsById, targets);
    const spilledRecord = Object.fromEntries(
      Array.from(this.spilledReportIds).map((id) => [id, true]),
    );
    this.spilledReportIds = new Set(Object.keys(resetLeafStateMap(spilledRecord, targets)));
    this.recomputeOverviewCounts();
    this.bumpTree();
  }

  setRunState(next: Record<string, StepStatus>): void {
    this.leafRunStateById = next;
    this.recomputeOverviewCounts();
    this.bumpTree();
  }

  patchRunState(patches: Record<string, StepStatus>): void {
    if (Object.keys(patches).length === 0) {
      return;
    }
    const next = { ...this.leafRunStateById };
    for (const [id, status] of Object.entries(patches)) {
      next[id] = status;
    }
    this.leafRunStateById = next;
    this.recomputeOverviewCounts();
    this.bumpTree();
  }

  mergeRunState(pending: Record<string, StepStatus>): void {
    const next = { ...this.leafRunStateById };
    for (const [id, status] of Object.entries(pending)) {
      const current = next[id];
      if (current === undefined || current === 'default' || current === 'pending') {
        next[id] = status;
      }
    }
    this.leafRunStateById = next;
    this.recomputeOverviewCounts();
    this.bumpTree();
  }

  replaceRunState(updater: (prev: Record<string, StepStatus>) => Record<string, StepStatus>): void {
    const next = updater(this.leafRunStateById);
    if (next === this.leafRunStateById) {
      return;
    }
    this.leafRunStateById = next;
    this.recomputeOverviewCounts();
    this.bumpTree();
  }

  appendReports(patches: Record<string, StepReportItem[]>): Record<string, StepReportItem[]> {
    const reportIds = Object.keys(patches);
    if (reportIds.length === 0) {
      return this.leafReportsById;
    }

    const next = { ...this.leafReportsById };
    const nextStats = { ...this.reportStatsById };
    let overview = { ...this.overview };

    reportIds.forEach((id) => {
      const hadReportData = nodeHasReportData(
        id,
        this.leafReportsById,
        this.reportStatsById,
        this.spilledReportIds,
      );
      next[id] = [...(next[id] || []), ...patches[id]];
      if (!this.spilledReportIds.has(id)) {
        nextStats[id] = computeReportStats(next[id]);
      }
      if (!hadReportData && nodeHasReportData(id, next, nextStats, this.spilledReportIds)) {
        overview = { ...overview, fileCount: overview.fileCount + 1 };
      }
      for (const report of patches[id]) {
        if (report.status === 'failed') {
          overview = { ...overview, failed: overview.failed + 1 };
        } else {
          overview = { ...overview, passed: overview.passed + 1 };
        }
      }
      overview = { ...overview, hasReportData: true };
    });

    this.leafReportsById = next;
    this.reportStatsById = nextStats;
    this.bumpOverview(overview);
    this.bumpTree();
    return next;
  }

  applySpill(
    spilled: Set<string>,
    stats: Record<string, ReportStepStats>,
    clearedIds: readonly string[],
  ): void {
    const next = { ...this.leafReportsById };
    clearedIds.forEach((id) => {
      next[id] = [];
    });
    this.leafReportsById = next;
    this.spilledReportIds = new Set(spilled);
    this.reportStatsById = { ...stats };
    this.syncOverviewFlags();
    this.bumpTree();
  }

  clearSpillState(): void {
    this.spilledReportIds = new Set();
    this.reportStatsById = {};
    this.loadingReportIds = new Set();
    this.syncOverviewFlags();
    this.bumpTree();
  }

  setLoadingReport(nodeId: string, loading: boolean): void {
    const next = new Set(this.loadingReportIds);
    if (loading) {
      if (next.has(nodeId)) {
        return;
      }
      next.add(nodeId);
    } else {
      if (!next.has(nodeId)) {
        return;
      }
      next.delete(nodeId);
    }
    this.loadingReportIds = next;
    this.bumpTree();
  }

  mergeLoadedReports(nodeId: string, reports: StepReportItem[]): void {
    const inline = this.leafReportsById[nodeId] || [];
    const nextReports = inline.length ? [...reports, ...inline] : reports;
    const hadReportData = nodeHasReportData(
      nodeId,
      this.leafReportsById,
      this.reportStatsById,
      this.spilledReportIds,
    );
    this.leafReportsById = {
      ...this.leafReportsById,
      [nodeId]: nextReports,
    };
    const nextSpilled = new Set(this.spilledReportIds);
    nextSpilled.delete(nodeId);
    this.spilledReportIds = nextSpilled;
    if (!hadReportData && nextReports.length > 0) {
      this.bumpOverview({
        ...this.overview,
        fileCount: this.overview.fileCount + 1,
        hasReportData: true,
      });
    }
    this.bumpTree();
  }

  resetReportsMap(next: Record<string, StepReportItem[]>): void {
    this.leafReportsById = next;
    this.recomputeOverviewCounts();
    this.bumpTree();
  }
}

export function createSuiteRunDataStore(): SuiteRunDataStore {
  return new SuiteRunDataStore();
}

export function useSuiteRunTreeVersion(store: SuiteRunDataStore): number {
  return useSyncExternalStore(store.subscribeTree, store.getTreeVersion, store.getTreeVersion);
}

export function useSuiteRunOverview(store: SuiteRunDataStore): SuiteRunOverview {
  return useSyncExternalStore(store.subscribeOverview, store.getOverview, store.getOverview);
}
