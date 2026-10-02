import React, { useMemo, useContext, useState, useEffect, useRef } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "mmt-core/safer";
import { JSONRecord, JSONValue } from "mmt-core/CommonData";
import FilePickerInput from "./FilePickerInput";
import { FileContext } from '../fileContext';
import {
  inputBoxToYamlString,
  inputBoxToYamlValueWithTokens,
  yamlValueToInputBoxWithTokens,
} from "./convertor";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";
import { isIncompleteJsonLiteral } from "mmt-core/yamlValueConvert";
import {
  entriesToUniqueRecord,
  findDuplicateKeyIndexes,
  resolveKvDraftSync,
  withTrailingEmptyRow,
  type KvEntry,
} from "./kvEntryDraft";
import StableTextInput from "./StableTextInput";
import {
  handleKvEditorTab,
  KV_FIELD_ATTR,
  kvFieldId,
} from "./kvFieldNav";

type KSVEditorBaseProps = {
  label: string;
  value?: string | Record<string, string> | JSONRecord;
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
};

type KSVEditorProps = KSVEditorBaseProps & (
  | {
    /** Keep YAML types (number / bool / null) in values. */
    typedValues: true;
    onChange: (v: JSONRecord) => void;
  }
  | {
    typedValues?: false;
    onChange: (v: Record<string, string>) => void;
  }
);

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
  typedValues = false,
}) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const propEntries = useMemo(
    () => withTrailingEmptyKey(value, canContainToken, expandable),
    [value, canContainToken, expandable],
  );
  const [draft, setDraft] = useState<KvEntry[] | null>(null);
  const entries = draft ?? propEntries;
  const duplicateIndexes = useMemo(() => findDuplicateKeyIndexes(entries), [entries]);
  const publishedRef = useRef<KvEntry[] | null>(null);
  const prevPropEntriesRef = useRef(propEntries);

  // Drop local draft once keys are unique and the echoed text matches.
  // Keep the draft while a value is mid-edit incomplete JSON, or while we are
  // waiting for our own YAML round-trip. If props change to something else
  // (left YAML editor), drop the draft so the UI follows the file.
  useEffect(() => {
    const prevProps = prevPropEntriesRef.current;

    if (!draft) {
      prevPropEntriesRef.current = propEntries;
      return;
    }

    const action = resolveKvDraftSync({
      draft,
      propEntries,
      prevPropEntries: prevProps,
      published: publishedRef.current,
      expandable,
      blockWhileIncomplete: typedValues &&
        draft.some(([k, v]) => k.trim() !== "" && isIncompleteJsonLiteral(v)),
    });

    if (action.type === 'keep') {
      prevPropEntriesRef.current = propEntries;
      return;
    }
    if (action.type === 'normalizeTrailing') {
      publishedRef.current = action.entries;
      setDraft(action.entries);
      prevPropEntriesRef.current = propEntries;
      return;
    }
    publishedRef.current = null;
    setDraft(null);
    prevPropEntriesRef.current = propEntries;
  }, [propEntries, draft, typedValues, expandable]);

  const safeOptions = Array.isArray(options) ? options : [];

  const fileCtx = useContext(FileContext);
  const effectiveFilePickerFilters = filePickerFilters || [{
    name: 'MMT, data, HTTP, Bruno, and JS files',
    extensions: ['mmt', 'csv', 'json', 'yaml', 'yml', 'http', 'https', 'bru', 'bruno', 'js', 'cjs', 'mjs'],
  }];

  const publish = (next: KvEntry[]) => {
    const shown = withTrailingEmptyRow(next, expandable);
    publishedRef.current = shown;
    setDraft(shown);
    if (typedValues &&
        next.some(([k, v]) => k.trim() !== "" && isIncompleteJsonLiteral(v))) {
      // Draft only — do not overwrite structured YAML with "{".
      return;
    }
    if (typedValues) {
      const typedOnChange = onChange as (v: JSONRecord) => void;
      typedOnChange(entriesToUniqueRecord(
        next,
        (display) => inputBoxToYamlValueWithTokens(display, canContainToken),
      ));
      return;
    }
    const stringOnChange = onChange as (v: Record<string, string>) => void;
    stringOnChange(entriesToUniqueRecord(
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
      <table
        ref={tableRef}
        className="field-table"
        onKeyDown={e => {
          handleKvEditorTab(e, tableRef.current);
        }}
      >
        <tbody>
          {safeList(entries)
            .filter(([k], i) => !(deactivated && k === "" && i === entries.length - 1))
            .map(([k, v], i) => (
              <tr key={i}>
                <td>
                  <StableTextInput
                    value={k}
                    onChange={next => handleKeyChange(i, next)}
                    placeholder={keyPlaceholder}
                    disabled={disabled || keysDisabled}
                    readOnly={readOnly || deactivated}
                    className={duplicateIndexes.has(i) ? "is-invalid" : undefined}
                    title={duplicateIndexes.has(i) ? "Duplicate key" : undefined}
                    aria-invalid={duplicateIndexes.has(i)}
                    {...{ [KV_FIELD_ATTR]: kvFieldId(i, "key") }}
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
                        kvField={kvFieldId(i, "value")}
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
                        kvField={kvFieldId(i, "value")}
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
                        kvField={kvFieldId(i, "value")}
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
