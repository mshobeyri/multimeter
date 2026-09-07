import {
  isMmtFileType,
  MmtFileType,
  mmtFileTypeColor,
  mmtFileTypeIcon,
} from 'mmt-core/mmtFileType';

export type TempMmtType = MmtFileType|null;

export interface TempFileMeta {
  type: TempMmtType;
  title: string;
  icon: string;
  color: string;
}

export function parseTempFileMeta(
    content: string, fallbackTitle = 'Untitled'): TempFileMeta {
  const type = parseType(content);
  const yamlTitle = parseTitle(content);
  const title = (yamlTitle || fallbackTitle).trim() || 'Untitled';
  if (!type) {
    return {type: null, title, icon: 'file', color: ''};
  }
  return {
    type,
    title,
    icon: mmtFileTypeIcon(type),
    color: mmtFileTypeColor(type),
  };
}

export function parseType(content: string): TempMmtType {
  const match = String(content || '').match(/^\s*type:\s*['"]?([a-zA-Z0-9_-]+)/m);
  if (!match) {
    return null;
  }
  const value = match[1].toLowerCase();
  return isMmtFileType(value) ? value : null;
}

export function parseTitle(content: string): string|null {
  const match = String(content || '').match(/^\s*title:\s*(.+)$/m);
  if (!match) {
    return null;
  }
  let raw = match[1].trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith('\'') && raw.endsWith('\''))) {
    raw = raw.slice(1, -1);
  }
  return raw.trim() || null;
}

export function sanitizeTempFileName(name: string): string {
  const base = String(name || '').trim().replace(/[\\/]+/g, '') || 'untitled.mmt';
  if (base.toLowerCase().endsWith('.mmt')) {
    return base;
  }
  return `${base}.mmt`;
}

export function uniqueTempFileName(
    desired: string, existing: string[]): string {
  const sanitized = sanitizeTempFileName(desired);
  const dot = sanitized.lastIndexOf('.');
  const ext = dot >= 0 ? sanitized.slice(dot) : '.mmt';
  const stem = dot >= 0 ? sanitized.slice(0, dot) : sanitized;
  const used = new Set(existing.map(item => item.toLowerCase()));
  let candidate = sanitized;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${stem}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

export function sortTempFiles<T extends {
  archived?: boolean;
  pinned: boolean;
  createdAt: number;
}>(files: T[]): T[] {
  return [...files].sort((a, b) => {
    const aArchived = !!a.archived;
    const bArchived = !!b.archived;
    if (aArchived !== bArchived) {
      return aArchived ? 1 : -1;
    }
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return b.createdAt - a.createdAt;
  });
}

export function formatRelativeTime(updatedAt: number, now = Date.now()): string {
  const ms = Math.max(0, now - updatedAt);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  if (ms < minute) {
    return 'just now';
  }
  if (ms < hour) {
    const n = Math.floor(ms / minute);
    return n === 1 ? '1 min ago' : `${n} min ago`;
  }
  if (ms < day) {
    const n = Math.floor(ms / hour);
    return n === 1 ? '1 hr ago' : `${n} hr ago`;
  }
  if (ms < month) {
    const n = Math.floor(ms / day);
    return n === 1 ? '1 day ago' : `${n} days ago`;
  }
  const n = Math.max(1, Math.floor(ms / month));
  return n === 1 ? '1 mo ago' : `${n} mos ago`;
}
