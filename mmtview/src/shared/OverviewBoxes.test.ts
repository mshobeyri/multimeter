/** Rate math mirrored from OverviewBoxes (passed + failed only; skipped excluded). */
export function overviewPassRate(passed: number, failed: number): string {
  const executed = passed + failed;
  return executed > 0 ? `${((passed / executed) * 100).toFixed(1)}%` : '-';
}

describe('OverviewBoxes pass rate', () => {
  it('returns 100% when nothing failed even if items were skipped elsewhere', () => {
    expect(overviewPassRate(1572, 0)).toBe('100.0%');
  });

  it('excludes skipped from the executed denominator', () => {
    expect(overviewPassRate(8, 2)).toBe('80.0%');
  });

  it('returns dash when nothing executed', () => {
    expect(overviewPassRate(0, 0)).toBe('-');
  });
});
