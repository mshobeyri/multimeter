import { readReportSpillBytes } from './reportSpillConfig';
import {
  computeReportStats,
  estimateReportsMapBytes,
  pickReportNodeToSpill,
  type ReportStepStats,
} from './reportSpillLogic';
import { putSpilledReportsBatch } from './reportSpillStore';
import type { StepReportItem } from './TestStepReportPanel';

export async function spillExcessReports(options: {
  reports: Record<string, StepReportItem[]>;
  spilled: Set<string>;
  stats: Record<string, ReportStepStats>;
  fileKey: string;
  suiteRunId: string;
  /** Expanded/open report rows stay in memory until the user collapses them. */
  protectNodeIds?: Set<string>;
}): Promise<{
  reports: Record<string, StepReportItem[]>;
  spilled: Set<string>;
  stats: Record<string, ReportStepStats>;
  didSpill: boolean;
}> {
  const thresholdBytes = readReportSpillBytes();
  if (thresholdBytes <= 0 || !options.fileKey || !options.suiteRunId) {
    return { ...options, didSpill: false };
  }

  const nextReports = { ...options.reports };
  const nextSpilled = new Set(options.spilled);
  const nextStats = { ...options.stats };
  let bytes = estimateReportsMapBytes(nextReports);
  let didSpill = false;

  // Decide everything first (pure, in memory), then write it in one batch.
  const toWrite: Array<{ nodeId: string; reports: StepReportItem[] }> = [];
  while (bytes > thresholdBytes) {
    const nodeId = pickReportNodeToSpill(nextReports, nextSpilled, options.protectNodeIds);
    if (!nodeId) {
      break;
    }
    const nodeReports = nextReports[nodeId];
    if (!nodeReports?.length) {
      break;
    }
    nextStats[nodeId] = computeReportStats(nodeReports);
    toWrite.push({ nodeId, reports: nodeReports });
    nextReports[nodeId] = [];
    nextSpilled.add(nodeId);
    bytes = estimateReportsMapBytes(nextReports);
    didSpill = true;
  }

  if (toWrite.length > 0) {
    // Rejects on failure: the caller then keeps all reports in memory (nothing is marked spilled).
    await putSpilledReportsBatch(options.fileKey, options.suiteRunId, toWrite);
  }

  return {
    reports: nextReports,
    spilled: nextSpilled,
    stats: nextStats,
    didSpill,
  };
}
