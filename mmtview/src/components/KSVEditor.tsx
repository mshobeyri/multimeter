import React, { useMemo, useContext, useState, useEffect } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "mmt-core/safer";
import { JSONRecord, JSONValue } from "mmt-core/CommonData";
import FilePickerInput from "./FilePickerInput";
import { FileContext } from '../fileContext';
import {
  inputBoxToYamlString,
  yamlValueToInputBoxWithTokens,
} from "./convertor";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";
import {
  entriesToUniqueRecord,
  findDuplicateKeyIndexes,
  type KvEntry,
} from "./kvEntryDraft";

interface KSVEditorProps {
  label: string;
  value?: string | Record<string, string> | JSONRecord;
  onChange: (v: Record<string, string>) => void;
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

function withTrailingEmptyKey(
  obj: string | Record<string, string> | JSONRecord | undefined,
  tokens: boolean,
  addEmpty: boolean = true,
): KvEntry[] {
  if (!obj) {
    return addEmpty ? [["", ""]] : [];
  }

  if (typeof obj === "string") {
    return addEmpty ? [["", ""]] : [];
  }

  const entries = Object.entries(obj).map(([key, value]): KvEntry => [
    key,
    yamlValueToInputBoxWithTokens(value as JSONValue, tokens),
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
  const propEntries = useMemo(
    () => withTrailingEmptyKey(value, canContainToken, expandable),
    [value, canContainToken, expandable],
  );
  const [draft, setDraft] = useState<KvEntry[] | null>(null);
  const entries = draft ?? propEntries;
  const duplicateIndexes = useMemo(() => findDuplicateKeyIndexes(entries), [entries]);

  // Drop local draft once keys are unique again and props have caught up.
  useEffect(() => {
    if (!draft) {
      return;
    }
    if (findDuplicateKeyIndexes(draft).size === 0) {
      setDraft(null);
    }
  }, [propEntries, draft]);

  const safeOptions = Array.isArray(options) ? options : [];

  const fileCtx = useContext(FileContext);
  const effectiveFilePickerFilters = filePickerFilters || [{
    name: 'MMT, data, HTTP, Bruno, and JS files',
    extensions: ['mmt', 'csv', 'json', 'yaml', 'yml', 'http', 'https', 'bru', 'bruno', 'js', 'cjs', 'mjs'],
  }];

  const publish = (next: KvEntry[]) => {
    setDraft(next);
    onChange(entriesToUniqueRecord(
      next,
      (display) => inputBoxToYamlString(display, canContainToken),
    ));
  };

  const handleKeyChange = (idx: number, newKey: string) => {
    const newEntries = safeList(entries).map(([k, v], i): KvEntry =>
      i === idx ? [newKey, v] : [k, v]
    );
    publish(newEntries);
  };

  const handleValueChange = (idx: number, newVal: string) => {
    const newEntries = safeList(entries).map(([k, v], i): KvEntry =>
      i === idx ? [k, newVal] : [k, v]
    );
    publish(newEntries);
  };

  const handleRemove = (idx: number) => {
    const newEntries = safeList(entries).filter((_, i) => i !== idx);
    publish(newEntries);
  };

  return (
    <div className={`mmt-fill${deactivated ? " is-deactivated" : ""}`}>
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
                    placeholder={keyPlaceholder}
                    disabled={disabled || keysDisabled}
                    readOnly={readOnly || deactivated}
                    className={duplicateIndexes.has(i) ? "is-invalid" : undefined}
                    title={duplicateIndexes.has(i) ? "Duplicate key" : undefined}
                    aria-invalid={duplicateIndexes.has(i)}
                  />
                </td>
                <td>
                  {k.trim() !== "" && (
                    filePicker ? (
                      <FilePickerInput
                        value={v}
                        onChange={newVal => handleValueChange(i, newVal)}
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
                          const newEntries = safeList(entries).map(([key, val], idx): KvEntry =>
                            idx === i ? [key, newVal] : [key, val]
                          );
                          publish(newEntries);
                        }}
                        onRemovePressed={() => handleRemove(i)}
                        options={safeOptions}
                        placeholder={valuePlaceholder}
                        disabled={disabled || readOnly || deactivated}
                        removable={deletable && !deactivated && !readOnly}
                      />
                    ) : (
                      <FieldWithRemove
                        value={v}
                        onChange={newVal => handleValueChange(i, newVal)}
                        onRemovePressed={() => handleRemove(i)}
                        placeholder={valuePlaceholder}
                        disabled={disabled}
                        readOnly={readOnly || deactivated}
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
