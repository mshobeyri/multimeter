import React, { useMemo, useContext, useState, useEffect, useRef, useCallback } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "mmt-core/safer";
import { JSONRecord, JSONValue } from "mmt-core/CommonData";
import FilePickerInput from "./FilePickerInput";
import { FileContext } from '../fileContext';
import { valueToString, stringToValue } from "./convertor";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";

interface KSVEditorProps {
  label: string;
  value?: string | Record<string, string> | JSONRecord;
  onChange: (v: Record<string, string>) => void;
  /**
   * `live` (default): every keystroke calls onChange.
   * `blur`: keep a local draft while focused; call onChange on blur, Enter,
   * or row remove — avoids mid-token YAML writes in the API tester peer.
   */
  commitMode?: "live" | "blur";
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  options?: string[];
  disabled?: boolean;
  /** Non-editable but visually normal (unlike disabled). */
  readOnly?: boolean;
  deactivated?: boolean;
  keysDisabled?: boolean;
  deletable?: boolean;
  expandable?: boolean;
  /** Show copy buttons on value fields (useful for read-only outputs). */
  copyable?: boolean;
  filePicker?: boolean;
  filePickerFilters?: Array<{ name?: string; extensions?: string[] }>;
  /** Value fields: resolved/token dual-mode when a value contains tokens. */
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
}

function toStoredString(display: string): string {
  const typed = stringToValue(display);
  if (typeof typed === "string") {
    return typed;
  }
  return valueToString(typed as JSONValue);
}

// Utility to ensure an empty key is always at the end
function withTrailingEmptyKey(
  obj?: string | Record<string, string> | JSONRecord,
  addEmpty: boolean = true,
): Array<[string, string]> {
  if (!obj) {
    return addEmpty ? [["", ""]] : [];
  }

  if (typeof obj === "string") {
    return addEmpty ? [["", ""]] : [];
  }

  // Display via convertor so omit / numbers / quoted token literals stay correct
  // and `__MMT_LITERAL__:` never leaks into the field UI.
  const entries = Object.entries(obj).map(([key, value]): [string, string] => [
    key,
    valueToString(value as JSONValue),
  ]);

  if (addEmpty && (entries.length === 0 || entries[entries.length - 1][0] !== "")) {
    return [...entries, ["", ""]];
  }
  return entries;
}

const KSVEditor: React.FC<KSVEditorProps> = ({
  label,
  value,
  onChange,
  commitMode = "live",
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  options,
  disabled,
  readOnly = false,
  deactivated = false,
  keysDisabled = false,
  deletable = true,
  expandable = true,
  copyable = false,
  filePicker = false,
  filePickerFilters,
  canContainToken = false,
  valueContext,
}) => {
  const commitOnBlur = commitMode === "blur";
  const entriesFromProps = useMemo(
    () => withTrailingEmptyKey(value, expandable),
    [value, expandable],
  );
  const [draft, setDraft] = useState<Array<[string, string]> | null>(null);
  const focusedRef = useRef(false);
  const draftRef = useRef<Array<[string, string]> | null>(null);
  draftRef.current = draft;

  const entries = draft ?? entriesFromProps;
  const safeOptions = Array.isArray(options) ? options : [];

  const fileCtx = useContext(FileContext);
  const effectiveFilePickerFilters = filePickerFilters || [{
    name: 'MMT, data, HTTP, Bruno, and JS files',
    extensions: ['mmt', 'csv', 'json', 'yaml', 'yml', 'http', 'https', 'bru', 'bruno', 'js', 'cjs', 'mjs'],
  }];

  // External YAML / prop updates win when the editor is not focused.
  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(null);
    }
  }, [entriesFromProps]);

  const toObject = (arr: Array<[string, string]>): Record<string, string> =>
    safeList(arr).reduce<Record<string, string>>((acc, [k, v]) => {
      if (k.trim()) {
        acc[k] = toStoredString(v);
      }
      return acc;
    }, {});

  const commitEntries = useCallback((next: Array<[string, string]>) => {
    onChange(toObject(next));
  }, [onChange]);

  const updateEntries = (next: Array<[string, string]>, opts?: { commit?: boolean }) => {
    if (commitOnBlur && !opts?.commit) {
      setDraft(next);
      return;
    }
    setDraft(commitOnBlur ? next : null);
    commitEntries(next);
  };

  const handleKeyChange = (idx: number, newKey: string) => {
    const newEntries = safeList(entries).map(([k, v], i): [string, string] =>
      i === idx ? [newKey, v] : [k, v]
    );

    const seen = new Set<string>();
    const filtered = newEntries.filter(([k], i) => {
      if (!k.trim()) return true;
      if (seen.has(k) && i !== idx) return false;
      seen.add(k);
      return true;
    });

    updateEntries(filtered);
  };

  const handleValueChange = (idx: number, newVal: string) => {
    const newEntries = safeList(entries).map(([k, v], i): [string, string] =>
      i === idx ? [k, newVal] : [k, v]
    );
    updateEntries(newEntries);
  };

  const handleRemove = (idx: number) => {
    const newEntries = safeList(entries).filter((_, i) => i !== idx);
    // Structural edits commit immediately even in blur mode.
    updateEntries(newEntries, { commit: true });
  };

  const commitDraftIfNeeded = () => {
    if (!commitOnBlur) {
      return;
    }
    const current = draftRef.current;
    if (current) {
      commitEntries(current);
    }
  };

  return (
    <div
      className="mmt-fill"
      onFocusCapture={() => {
        focusedRef.current = true;
      }}
      onBlurCapture={e => {
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) {
          return;
        }
        focusedRef.current = false;
        commitDraftIfNeeded();
      }}
    >
      {label ? (
        <div
          className={disabled ? "label label-disabled" : "label"}
        >
          {label}
        </div>
      ) : null}
      <table className="field-table">
        <tbody>
          {safeList(entries)
            .filter(([k], i) => !(deactivated && k === "" && i === entries.length - 1))
            .map(([k, v], i) => (
              <tr key={i}>
                <td>
                  <input
                    value={k}
                    onChange={e => handleKeyChange(i, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitDraftIfNeeded();
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    placeholder={keyPlaceholder}
                    disabled={disabled || keysDisabled}
                    readOnly={readOnly}
                  />
                </td>
                <td>
                  {k.trim() !== "" && (
                    filePicker ? (
                      <FilePickerInput
                        value={v}
                        onChange={newVal => handleValueChange(i, newVal)}
                        onEnterPressed={() => {
                          commitDraftIfNeeded();
                        }}
                        onRemovePressed={() => handleRemove(i)}
                        basePath={fileCtx?.mmtFilePath}
                        filters={effectiveFilePickerFilters}
                        showFilePicker={true}
                        removable={deletable && !deactivated && !readOnly}
                      />
                    ) : safeOptions.length > 0 ? (
                      <SelectWithRemove
                        value={v}
                        onChange={newVal => {
                          // Selects are discrete — always commit.
                          const newEntries = safeList(entries).map(([key, val], idx): [string, string] =>
                            idx === i ? [key, newVal] : [key, val]
                          );
                          updateEntries(newEntries, { commit: true });
                        }}
                        onRemovePressed={() => handleRemove(i)}
                        options={safeOptions}
                        placeholder={valuePlaceholder}
                        disabled={disabled || readOnly}
                        removable={deletable && !deactivated && !readOnly}
                      />
                    ) : (
                      <FieldWithRemove
                        value={v}
                        onChange={newVal => handleValueChange(i, newVal)}
                        onEnter={() => commitDraftIfNeeded()}
                        onRemovePressed={() => handleRemove(i)}
                        placeholder={valuePlaceholder}
                        disabled={disabled}
                        readOnly={readOnly}
                        removable={deletable && !deactivated && !readOnly}
                        copyable={copyable}
                        canContainToken={canContainToken}
                        valueContext={valueContext}
                      />
                    )
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

export default KSVEditor;
