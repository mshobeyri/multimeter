import type { TreeItem, TreeItemIndex } from 'react-complex-tree';
import type { SuiteTestTreeItemData } from './SuiteTestTree';

export const GROUP_RANGE_LABEL_MAX_CHARS = 30;

const basename = (p: string): string => {
  const s = (p || '').replace(/\\/g, '/');
  const idx = s.lastIndexOf('/');
  return idx >= 0 ? s.slice(idx + 1) : s;
};

const relativeToParentDir = (childPath: string, parentPath: string): string => {
  if (!childPath || !parentPath) {
    return childPath;
  }
  const normalize = (p: string) => p.replace(/\\/g, '/');
  const child = normalize(childPath);
  const parent = normalize(parentPath);
  const parentDir = parent.includes('/') ? parent.slice(0, parent.lastIndexOf('/') + 1) : '';
  if (parentDir && child.startsWith(parentDir)) {
    return child.slice(parentDir.length);
  }
  return childPath;
};

/** Same display name rules as suite tree file rows. */
export function suiteTreeItemDisplayName(data: SuiteTestTreeItemData): string {
  if (data.type === 'group') {
    return data.label;
  }
  if (data.type === 'root') {
    return data.label;
  }

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (title) {
    return title;
  }

  const rawPath = data.path;
  if (!rawPath || typeof rawPath !== 'string') {
    return '';
  }

  const parentPath = data.parentPath;
  if (typeof parentPath === 'string' && parentPath) {
    const rel = relativeToParentDir(rawPath, parentPath);
    return rel && rel !== rawPath ? rel : basename(rawPath);
  }

  return basename(rawPath);
}

export function truncateGroupRangeSide(label: string, maxLen = GROUP_RANGE_LABEL_MAX_CHARS): string {
  if (!label || label.length <= maxLen) {
    return label;
  }
  if (maxLen <= 1) {
    return '…';
  }
  return `${label.slice(0, maxLen - 1)}…`;
}

export function buildGroupChildrenRangeLabel(
  childIds: readonly TreeItemIndex[],
  items: Record<string, TreeItem<SuiteTestTreeItemData>>,
): string | undefined {
  const names: string[] = [];
  for (const childId of childIds) {
    const child = items[String(childId)];
    const data = child?.data;
    if (!data || data.type === 'root') {
      continue;
    }
    const name = suiteTreeItemDisplayName(data);
    if (name) {
      names.push(name);
    }
  }

  if (names.length === 0) {
    return undefined;
  }
  if (names.length === 1) {
    return names[0];
  }

  const first = truncateGroupRangeSide(names[0]);
  const last = truncateGroupRangeSide(names[names.length - 1]);
  return `${first}..${last}`;
}

export function applyGroupChildrenRangeLabels(
  items: Record<string, TreeItem<SuiteTestTreeItemData>>,
): Record<string, TreeItem<SuiteTestTreeItemData>> {
  let changed = false;
  const next: Record<string, TreeItem<SuiteTestTreeItemData>> = { ...items };

  for (const [id, item] of Object.entries(items)) {
    if (item.data?.type !== 'group') {
      continue;
    }
    const rangeLabel = buildGroupChildrenRangeLabel(item.children || [], items);
    if (rangeLabel === item.data.childrenRangeLabel) {
      continue;
    }
    changed = true;
    next[id] = {
      ...item,
      data: {
        ...item.data,
        childrenRangeLabel: rangeLabel,
      },
    };
  }

  return changed ? next : items;
}
