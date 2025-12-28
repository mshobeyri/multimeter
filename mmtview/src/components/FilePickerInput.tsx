import React, { useMemo, useState } from 'react';
import { openOsFilePicker } from '../vsAPI';
import fileHelper from 'mmt-core/fileHelper';

type FileFilter = { name?: string; extensions?: string[] };

interface FilePickerInputProps {
  value?: string;
  basePath?: string; // absolute base folder to open picker at and to compute relative paths from
  filters?: FileFilter[]; // file type filters (extensions without dot, e.g. ['mmt','yaml'])
  onChange?: (file: string) => void;
}

const ensureTrailingSep = (p?: string) => {
  if (!p) return '';
  return p.endsWith('/') || p.endsWith('\\') ? p : p + '/';
};


const FilePickerInput: React.FC<FilePickerInputProps> = ({
  value = '',
  basePath,
  filters = [],
  onChange,
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

  const makeAbsoluteFromInput = (inputVal: string) => {
    if (!inputVal) return '';
    if (inputVal.startsWith('/') || /^[A-Za-z]:[\\/\\\\]/.test(inputVal) || inputVal.startsWith('file://')) {
      return inputVal;
    }
    if (basePath) {
      let bp = basePath;
      if (bp.startsWith('file://')) bp = bp.replace(/^file:\/\/+/i, '/');
      bp = bp.replace(/\\/g, '/');
      let baseDir = bp;
      if (!baseDir.endsWith('/')) {
        const lastSlash = baseDir.lastIndexOf('/');
        const lastDot = baseDir.lastIndexOf('.');
        if (lastDot > lastSlash) {
          baseDir = baseDir.slice(0, lastSlash + 1);
        } else {
          baseDir = ensureTrailingSep(baseDir);
        }
      }
      return (baseDir ? baseDir : '') + inputVal;
    }
    return inputVal;
  };

  const handleOpenPicker = async () => {
    try {
      const res = await openOsFilePicker({ filters: filterPayload, defaultPath: basePath, canSelectMany: false });
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
    } catch (err) {
      console.warn('Failed to open OS file picker', err);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={value}
        onChange={e => {
          onChange && onChange(e.target.value);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        style={{
          width: "100%",
          verticalAlign: "top"
        }}
        className="file-picker-input"
        title={value}
      />
      <button
        onClick={handleOpenPicker}
        title={filters && filters.length ? `Open file picker (${filters.map(f => f.name || f.extensions?.join(',')).join(';')})` : 'Open file picker'}
        aria-label="Open file picker"
        style={{
          position: "absolute",
          top: 1,
          right: 0,
          width: 28,
          height: 24,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          zIndex: 1
        }}
      >
        <span className="action-button codicon codicon-folder-opened" style={{ fontSize: "16px" }} />
      </button>
    </div>
  );
};

export default FilePickerInput;
