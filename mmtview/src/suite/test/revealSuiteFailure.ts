export type SuiteRevealItem = {
  children?: readonly (string | number)[];
  data?: { type?: string; id?: string };
};

/** Ids to expand so the first failed case under `startId` is open. */
export type SuiteFailureReveal = {
  expandIds: string[];
  terminalId: string;
  /** True when a failed descendant is not in the tree yet (hierarchy still loading). */
  needsChildren: boolean;
};

function loadedBundleIds(items: Record<string, SuiteRevealItem>): Set<string> {
  const ids = new Set<string>();
  for (const item of Object.values(items)) {
    const id = item?.data?.id;
    if (typeof id === 'string' && id) {
      ids.add(id);
    }
  }
  return ids;
}

function hasUnloadedFailedDescendant(
  bundle: string | undefined,
  failedBundleIds: readonly string[],
  loaded: Set<string>,
): boolean {
  if (!bundle) {
    return false;
  }
  const prefix = `${bundle}.`;
  for (const failedId of failedBundleIds) {
    if (failedId.startsWith(prefix) && !loaded.has(failedId)) {
      return true;
    }
  }
  return false;
}

/**
 * Depth-first path from `startId` to the first failed test.
 * Passed siblings are skipped. A failed suite with children not loaded yet
 * sets `needsChildren` so the caller can retry after hierarchy arrives.
 */
export function revealSuiteFailurePath(
  items: Record<string, SuiteRevealItem>,
  isFailed: (itemId: string) => boolean,
  failedBundleIds: readonly string[],
  startId = 'suite-root',
): SuiteFailureReveal | null {
  const loaded = loadedBundleIds(items);

  const walk = (id: string): SuiteFailureReveal | null => {
    const item = items[id];
    if (!item) {
      return null;
    }
    const children = item.children || [];
    for (const childId of children) {
      const nested = walk(String(childId));
      if (nested) {
        return { ...nested, expandIds: [id, ...nested.expandIds] };
      }
    }

    const failed = isFailed(id);
    const bundle = item.data?.id;
    const unloaded = hasUnloadedFailedDescendant(bundle, failedBundleIds, loaded);
    if (!failed && !unloaded) {
      return null;
    }

    const type = item.data?.type;
    if ((type === 'test' || type === 'api') && failed) {
      return { expandIds: [id], terminalId: id, needsChildren: false };
    }
    const folder = type === 'suite' || type === 'group';
    if (unloaded || (folder && children.length === 0)) {
      return { expandIds: [id], terminalId: id, needsChildren: true };
    }
    if (failed) {
      return { expandIds: [id], terminalId: id, needsChildren: false };
    }
    return null;
  };

  return walk(startId);
}
