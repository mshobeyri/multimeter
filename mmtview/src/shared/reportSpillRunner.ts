import { readReportSpillBytes } from './reportSpillConfig';
import {
  computeReportStats,
  estimateReportsMapBytes,
  pickReportNodeToSpill,
  type ReportStepStats,
} from './reportSpillLogic';
import { putSpilledReports } from './reportSpillStore';
import type { StepReportItem } from './TestStepReportPanel';

export async function spillExcessReports(options: {
  reports: Record<string, StepReportItem[]>;
  spilled: Set<string>;
  stats: Record<string, ReportStepStats>;
  fileKey: string;
  suiteRunId: string;
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

  while (bytes > thresholdBytes) {
    const nodeId = pickReportNodeToSpill(nextReports, nextSpilled);
    if (!nodeId) {
      break;
    }
    const nodeReports = nextReports[nodeId];
    if (!nodeReports?.length) {
      break;
    }
    nextStats[nodeId] = computeReportStats(nodeReports);
    await putSpilledReports(options.fileKey, options.suiteRunId, nodeId, nodeReports);
    nextReports[nodeId] = [];
    nextSpilled.add(nodeId);
    bytes = estimateReportsMapBytes(nextReports);
    didSpill = true;
  }

  return {
    reports: nextReports,
    spilled: nextSpilled,
    stats: nextStats,
    didSpill,
  };
}
