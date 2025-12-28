import React, { useMemo, useState } from 'react';
import { openOsFilePicker } from '../vsAPI';
import fileHelper from 'mmt-core/fileHelper';

type FileFilter = { name?: string; extensions?: string[] };

interface FilePickerInputProps {
  ref?: any;
  value?: string;
  basePath?: string; // absolute base folder to open picker at and to compute relative paths from
  filters?: FileFilter[]; // file type filters (extensions without dot, e.g. ['mmt','yaml'])
  onChange?: (file: string) => void;
  onEnterPressed?: (file: string) => void;
  onRemovePressed?: () => void;
  allowFolders?: boolean;
}

const ensureTrailingSep = (p?: string) => {
  if (!p) return '';
  return p.endsWith('/') || p.endsWith('\\') ? p : p + '/';
};

const FilePickerInput: React.FC<FilePickerInputProps> = ({
  ref,
  value = '',
  basePath,
  filters = [],
  onChange,
  onEnterPressed,
  onRemovePressed,
  allowFolders = false,
}) => {
  const filterPayload = useMemo(() => {
    if (!filters || filters.length === 0) return undefined;
    const map: Record<string, string[]> = {};
    for (let i = 0; i < filters.length; i++) {
      const f = filters[i];
      const name = f.name && f.name.length ? f.name : `Files ${i + 1}`;
      if (f.extensions && f.extensions.length) {
        map[name] = f.extensions.map(e => (e.startsWith('.') ? e.slice(1) : e));
      }
    }
    return Object.keys(map).length ? map : undefined;
  }, [filters]);

  const handleOpenPicker = async () => {
    try {
      const res = await openOsFilePicker({ filters: filterPayload, defaultPath: basePath, canSelectMany: false, canSelectFolders: !!allowFolders });
      if (!res) return;
      if (res.cancelled) return;
      if (res.error) {
        console.warn('OS file picker error', res.error);
        return;
      }
      const abs = res.filePath || (Array.isArray(res.filePaths) && res.filePaths[0]);
      if (!abs) return;
      const rel = (fileHelper as any).computeRelative(basePath, abs);
      onChange && onChange(rel);
      onEnterPressed && onEnterPressed(rel);
    } catch (err) {
      console.warn('Failed to open OS file picker', err);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={e => {
            onChange && onChange(e.target.value);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
              onEnterPressed && onEnterPressed(value);
            }
          }}
          style={{
            width: '100%',
            verticalAlign: "top",
            paddingRight: 80
          }}
          className="file-picker-input"
          title={value}
        />
        <button
          onClick={handleOpenPicker}
          title={filters && filters.length ? `Open file picker (${filters.map(f => f.name || f.extensions?.join(',')).join(';')})` : 'Open file picker'}
          aria-label="Open file picker"
          className="field-button"
          style={{ position: 'absolute', right: onRemovePressed ? 36 : 4, top: '50%', transform: 'translateY(-50%)' }}
        >
          <span className="action-button codicon codicon-folder-opened" style={{ fontSize: "16px" }} />
        </button>
        {onRemovePressed && (
          <button
            onClick={() => {
              try {
                onRemovePressed && onRemovePressed();
              } catch (e) {
              }
            }}
            title="Clear"
            aria-label="Clear file"
            className="field-button"
            style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
          >
            <span className="action-button codicon codicon-close" style={{ fontSize: "16px" }} />
          </button>
        )}
      </div>
    </div>
  );
};

export default FilePickerInput;
