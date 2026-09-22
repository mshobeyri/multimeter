import { reportStepHasDetails, type StepReportItem } from './TestStepReportPanel';

const baseReport = (): StepReportItem => ({
  stepIndex: 1,
  stepType: 'check',
  status: 'passed',
  title: 'Check status',
  expects: [],
  timestamp: 1,
});

describe('reportStepHasDetails', () => {
  it('returns true when expects or raw details are present', () => {
    expect(reportStepHasDetails({
      ...baseReport(),
      expects: [{ comparison: 'a == b', status: 'passed', level: 'soft' } as any],
    })).toBe(true);
    expect(reportStepHasDetails({
      ...baseReport(),
      details: '{"_":{"status":200}}',
    })).toBe(true);
  });

  it('returns false for header-only rows without parsing details', () => {
    expect(reportStepHasDetails(baseReport())).toBe(false);
    expect(reportStepHasDetails({ ...baseReport(), details: '   ' })).toBe(false);
  });
});
