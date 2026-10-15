/**
 * Shared presentation for `.mmt` document types (gallery, temp files, panels).
 * Keep icons (codicon names) and accent colors here — do not duplicate elsewhere.
 */

export const MMT_FILE_TYPE_IDS = [
  'api',
  'test',
  'suite',
  'env',
  'loadtest',
  'doc',
  'server',
  'judge',
  'report',
] as const;

export type MmtFileType = (typeof MMT_FILE_TYPE_IDS)[number];

export interface MmtFileTypeMeta {
  label: string;
  /** Codicon name without the `codicon-` prefix */
  icon: string;
  /** Accent color for type icons / list rows */
  color: string;
}

export const MMT_FILE_TYPES: Record<MmtFileType, MmtFileTypeMeta> = {
  api: {label: 'API', icon: 'symbol-method', color: '#1f6feb'},
  test: {label: 'Test', icon: 'beaker', color: '#3fb950'},
  suite: {label: 'Suite', icon: 'layers', color: '#58a6ff'},
  env: {label: 'Environment', icon: 'server-environment', color: '#8957e5'},
  loadtest: {label: 'Load Test', icon: 'dashboard', color: '#db6d28'},
  doc: {label: 'Document', icon: 'book', color: '#d4a72c'},
  server: {label: 'Server', icon: 'server', color: '#39c5cf'},
  judge: {label: 'Judge', icon: 'law', color: '#e3b341'},
  report: {label: 'Report', icon: 'file-text', color: '#a371f7'},
};

/** Types offered when creating a new empty `.mmt` (excludes generated report). */
export const MMT_CREATABLE_FILE_TYPES: readonly MmtFileType[] = [
  'api', 'test', 'suite', 'env', 'loadtest', 'doc', 'server', 'judge',
];

export const MMT_FILE_TYPE_OPTIONS: ReadonlyArray<{value: MmtFileType; label: string}> =
    MMT_CREATABLE_FILE_TYPES.map((value) => ({
      value,
      label: MMT_FILE_TYPES[value].label,
    }));

const KNOWN = new Set<string>(MMT_FILE_TYPE_IDS);

export function isMmtFileType(value: string|null|undefined): value is MmtFileType {
  return typeof value === 'string' && KNOWN.has(value);
}

export function mmtFileTypeMeta(
    type: string|null|undefined): MmtFileTypeMeta|undefined {
  if (!isMmtFileType(type)) {
    return undefined;
  }
  return MMT_FILE_TYPES[type];
}

export function mmtFileTypeIcon(
    type: string|null|undefined, fallback = 'file'): string {
  return mmtFileTypeMeta(type)?.icon ?? fallback;
}

export function mmtFileTypeColor(
    type: string|null|undefined, fallback = ''): string {
  return mmtFileTypeMeta(type)?.color ?? fallback;
}

export function mmtFileTypeLabel(
    type: string|null|undefined, fallback?: string): string {
  const meta = mmtFileTypeMeta(type);
  if (meta) {
    return meta.label;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  return type || 'Unknown';
}
