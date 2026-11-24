import { spillExcessReports } from './reportSpillRunner';
import { putSpilledReportsBatch } from './reportSpillStore';
import type { StepReportItem } from './TestStepReportPanel';

jest.mock('./reportSpillStore', () => ({
  putSpilledReportsBatch: jest.fn(),
}));

jest.mock('./reportSpillConfig', () => ({
  readReportSpillBytes: () => 1000,
}));

const putBatch = putSpilledReportsBatch as jest.Mock;

function bigReports(stepCount: number): StepReportItem[] {
  const steps: any[] = [];
  for (let i = 0; i < stepCount; i += 1) {
    steps.push({ type: 'step', status: 'passed', title: 'x'.repeat(200) });
  }
  return steps as StepReportItem[];
}

describe('spillExcessReports batching', () => {
  beforeEach(() => {
    putBatch.mockReset();
    putBatch.mockResolvedValue(undefined);
  });

  it('writes every spilled node in one batch call', async () => {
    const reports = { a: bigReports(5), b: bigReports(5), c: bigReports(5), d: bigReports(5) };
    const result = await spillExcessReports({
      reports,
      spilled: new Set(),
      stats: {},
      fileKey: 'file',
      suiteRunId: 'run',
    });

    expect(result.didSpill).toBe(true);
    expect(putBatch).toHaveBeenCalledTimes(1);
    const entries = putBatch.mock.calls[0][2] as Array<{ nodeId: string }>;
    expect(entries.length).toBeGreaterThan(1);
    // Everything written is marked spilled, emptied in memory, and has stats.
    for (const entry of entries) {
      expect(result.spilled.has(entry.nodeId)).toBe(true);
      expect(result.reports[entry.nodeId]).toEqual([]);
      expect(result.stats[entry.nodeId]).toBeDefined();
    }
  });

  it('does not write when under the threshold', async () => {
    const result = await spillExcessReports({
      reports: { a: [] },
      spilled: new Set(),
      stats: {},
      fileKey: 'file',
      suiteRunId: 'run',
    });
    expect(result.didSpill).toBe(false);
    expect(putBatch).not.toHaveBeenCalled();
  });

  it('rejects without changing the input when the write fails', async () => {
    putBatch.mockRejectedValue(new Error('disk full'));
    const reports = { a: bigReports(5), b: bigReports(5), c: bigReports(5) };
    const input = {
      reports,
      spilled: new Set<string>(),
      stats: {},
      fileKey: 'file',
      suiteRunId: 'run',
    };

    await expect(spillExcessReports(input)).rejects.toThrow('disk full');
    // Caller's data is untouched, so nothing is lost or marked as spilled.
    expect(input.spilled.size).toBe(0);
    expect(input.reports.a.length).toBe(5);
    expect(input.reports.b.length).toBe(5);
    expect(input.reports.c.length).toBe(5);
  });
});
