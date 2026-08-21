/** Split items into rows so a wrap never leaves a single leftover when avoidable. */
export function packTypeRows<T>(items: T[], maxPerRow: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const cap = Math.max(1, Math.floor(maxPerRow) || 1);
  if (cap >= items.length) {
    return [items];
  }

  const rows: T[][] = [];
  let index = 0;
  while (index < items.length) {
    const remaining = items.length - index;
    let take = Math.min(cap, remaining);
    // 6+1 → 5+2; skip when remaining is 3 and cap is 2 (a singleton is unavoidable).
    if (remaining - take === 1 && take > 2) {
      take -= 1;
    }
    rows.push(items.slice(index, index + take));
    index += take;
  }
  return rows;
}

export function maxItemsPerRow(containerWidth: number, itemWidth: number, gap: number): number {
  if (itemWidth <= 0) {
    return 1;
  }
  const stride = itemWidth + Math.max(0, gap);
  return Math.max(1, Math.floor((containerWidth + Math.max(0, gap)) / stride));
}
