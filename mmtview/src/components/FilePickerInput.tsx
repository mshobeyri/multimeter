import React, { useMemo } from 'react';
import { openOsFilePicker } from '../vsAPI';
import fileHelper from 'mmt-core/fileHelper';
import type { RuntimeTokenValueContext } from 'mmt-core/apiBodyEdit';
import StableTextInput from './StableTextInput';
import TokenFieldInput from './TokenFieldInput';
import { KV_FIELD_ATTR } from './kvFieldNav';

type FileFilter = { name?: string; extensions?: string[] };

interface FilePickerInputProps {
  ref?: any;
  value?: string;
  basePath?: string;
  filters?: FileFilter[];
  onChange?: (file: string) => void;
  onEnterPressed?: (file: string) => void;
  onRemovePressed?: () => void;
  allowFolders?: boolean;
  disabled?: boolean;
  /** Show the folder-open picker button (default false) */
  showFilePicker?: boolean;
  /** Show the remove/clear button (default false) */
  removable?: boolean;
  placeholder?: string;
  /** Wavy red underline for a line-level validation error. */
  invalid?: boolean;
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
  kvField?: string;
}

const FilePickerInput: React.FC<FilePickerInputProps> = ({
  ref,
  value = '',
  basePath,
  filters = [],
  onChange,
  onEnterPressed,
  onRemovePressed,
  allowFolders = false,
  disabled = false,
  showFilePicker = false,
  removable = false,
  placeholder,
  invalid = false,
  canContainToken = false,
  valueContext,
  kvField,
}) => {
  const filterPayload = useMemo(() => {
    if (!filters || filters.length === 0) { return undefined; }
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
      const res = await openOsFilePicker({
        filters: filterPayload,
        defaultPath: basePath,
        canSelectMany: false,
        canSelectFolders: !!allowFolders
      });
      if (!res) { return; }
      if (res.cancelled) { return; }
      if (res.error) {
        console.warn('OS file picker error', res.error);
        return;
      }
      const abs = res.filePath || (Array.isArray(res.filePaths) && res.filePaths[0]);
      if (!abs) { return; }
      const rel = (fileHelper as any).computeRelative(basePath, abs);
      onChange && onChange(rel);
      onEnterPressed && onEnterPressed(rel);
    } catch (err) {
      console.warn('Failed to open OS file picker', err);
    }
  };

  const handleRemove = () => {
    if (onRemovePressed) {
      onRemovePressed();
    } else {
      onChange && onChange('');
    }
  };

  let rightPadding = 8;
  if (showFilePicker) { rightPadding += 28; }
  if (removable) { rightPadding += 28; }

  const inputClassName = ['file-picker-input', invalid ? 'mmt-line-error' : ''].filter(Boolean).join(' ');
  const kvAttr = kvField ? { [KV_FIELD_ATTR]: kvField } as Record<string, string> : undefined;

  return (
    <div className={`field-with-remove${disabled ? " is-disabled" : ""}${removable ? " has-remove" : ""}`}>
      {canContainToken && !disabled ? (
        <TokenFieldInput
          value={value}
          canContainToken
          valueContext={valueContext}
          placeholder={placeholder}
          style={{ paddingRight: rightPadding }}
          className={inputClassName}
          title={value}
          {...kvAttr}
          onCommit={next => {
            onChange?.(next);
            onEnterPressed?.(next);
          }}
          onDraftChange={next => onChange?.(next)}
        />
      ) : (
        <StableTextInput
          ref={ref}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={next => {
            onChange && onChange(next);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
              onEnterPressed && onEnterPressed((e.target as HTMLInputElement).value);
            }
          }}
          style={{ paddingRight: rightPadding }}
          className={inputClassName}
          title={value}
          {...kvAttr}
        />
      )}
      {showFilePicker && (
        <button
          type="button"
          tabIndex={-1}
          onClick={handleOpenPicker}
          disabled={disabled}
          title={
            filters && filters.length
              ? `Open file picker (${filters.map(f => f.name || f.extensions?.join(',')).join(';')})`
              : 'Open file picker'
          }
          aria-label="Open file picker"
          className="field-button"
          style={{ right: removable ? 32 : 4 }}
        >
          <span className="action-button codicon codicon-folder-opened" />
        </button>
      )}
      {removable && (
        <button
          type="button"
          tabIndex={-1}
          onClick={handleRemove}
          disabled={disabled}
          title="Remove"
          aria-label="Remove"
          className="field-button"
        >
          <span className="action-button codicon codicon-close" />
        </button>
      )}
    </div>
  );
};

export default FilePickerInput;
