import {
  isMmtFileType,
  MMT_CREATABLE_FILE_TYPES,
  MMT_FILE_TYPE_IDS,
  MMT_FILE_TYPES,
  mmtFileTypeColor,
  mmtFileTypeIcon,
  mmtFileTypeLabel,
  mmtFileTypeMeta,
} from './mmtFileType';

describe('mmtFileType', () => {
  it('covers every known id with label, icon, and color', () => {
    for (const id of MMT_FILE_TYPE_IDS) {
      const meta = MMT_FILE_TYPES[id];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.icon.length).toBeGreaterThan(0);
      expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('excludes report from creatable gallery types', () => {
    expect(MMT_CREATABLE_FILE_TYPES).not.toContain('report');
    expect(MMT_CREATABLE_FILE_TYPES).toContain('judge');
  });

  it('resolves judge presentation', () => {
    expect(isMmtFileType('judge')).toBe(true);
    expect(mmtFileTypeMeta('judge')).toEqual({
      label: 'Judge',
      icon: 'law',
      color: '#e3b341',
    });
    expect(mmtFileTypeIcon('judge')).toBe('law');
    expect(mmtFileTypeColor('judge')).toBe('#e3b341');
    expect(mmtFileTypeLabel('judge')).toBe('Judge');
  });

  it('falls back for unknown types', () => {
    expect(isMmtFileType('csv')).toBe(false);
    expect(mmtFileTypeMeta(null)).toBeUndefined();
    expect(mmtFileTypeIcon('nope')).toBe('file');
    expect(mmtFileTypeColor(undefined)).toBe('');
    expect(mmtFileTypeLabel('csv', 'CSV')).toBe('CSV');
  });
});
