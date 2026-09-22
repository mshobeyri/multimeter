import type { StepReportItem } from './TestStepReportPanel';

export type ReportStepStats = {
  passed: number;
  failed: number;
  stepCount: number;
};

export function computeReportStats(reports: StepReportItem[]): ReportStepStats {
  let passed = 0;
  let failed = 0;
  for (const report of reports) {
    if (report.status === 'failed') {
      failed += 1;
    } else {
      passed += 1;
    }
  }
  return { passed, failed, stepCount: reports.length };
}

export function estimateReportBytes(reports: StepReportItem[]): number {
  if (!reports.length) {
    return 0;
  }
  try {
    return new Blob([JSON.stringify(reports)]).size;
  } catch {
    return JSON.stringify(reports).length;
  }
}

export function estimateReportsMapBytes(map: Record<string, StepReportItem[]>): number {
  let total = 0;
  for (const reports of Object.values(map)) {
    total += estimateReportBytes(reports);
  }
  return total;
}

export function pickReportNodeToSpill(
  map: Record<string, StepReportItem[]>,
  alreadySpilled: Set<string>,
): string | undefined {
  let bestId: string | undefined;
  let bestSize = 0;
  for (const [id, reports] of Object.entries(map)) {
    if (alreadySpilled.has(id) || !reports.length) {
      continue;
    }
    const size = estimateReportBytes(reports);
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
  }
  return bestId;
}

export function makeReportSpillKey(fileKey: string, suiteRunId: string, nodeId: string): string {
  return `${fileKey}\0${suiteRunId}\0${nodeId}`;
}
