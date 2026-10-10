import React, { useMemo, useState, useEffect, useRef } from "react";
import FieldWithRemove from "./FieldWithRemove";
import { safeList } from "mmt-core/safer";
import { JSONRecord } from "mmt-core/CommonData";
import {
  yamlValueToInputBoxWithTokens,
  inputBoxToYamlValueWithTokens,
} from "./convertor";
import {
  isIncompleteJsonLiteral,
  yamlValueTypeLabel,
} from "mmt-core/yamlValueConvert";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";
import {
  entriesToUniqueRecord,
  findDuplicateKeyIndexes,
  kvEntriesContentEqual,
  kvEntriesEqual,
  withTrailingEmptyRow,
  type KvEntry,
} from "./kvEntryDraft";
import StableTextInput from "./StableTextInput";
import {
  handleKvEditorTab,
  KV_FIELD_ATTR,
  kvFieldId,
} from "./kvFieldNav";

interface KVEditorProps {
  label: string;
  value?: JSONRecord;
  onChange: (v: JSONRecord) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  disabled?: boolean;
  deactivated?: boolean;
  keysDisabled?: boolean;
  deletable?: boolean;
  expandable?: boolean;
  canContainToken?: boolean;
  /** Whole `<<c:city>>` shows as `{{c:city}}` and saves as `c:city`. */
  liveAngleTokens?: boolean;
  valueContext?: RuntimeTokenValueContext;
}

function withTrailingEmptyKey(
  obj: JSONRecord | undefined,
  tokens: boolean,
  addEmpty: boolean = true,
  liveAngleTokens: boolean = false,
): KvEntry[] {
  if (!obj) {
    return addEmpty ? [["", ""]] : [];
  }

  const entries = Object.entries(obj).map(([key, value]): KvEntry => [
    key,
    yamlValueToInputBoxWithTokens(value, tokens, liveAngleTokens),
  ]);

  if (addEmpty && (entries.length === 0 || entries[entries.length - 1][0] !== "")) {
    return [...entries, ["", ""]];
  }
  return entries;
}

const KVEditor: React.FC<KVEditorProps> = ({
  label,
  value,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  disabled,
  deactivated = false,
  keysDisabled = false,
  deletable = true,
  expandable = true,
  canContainToken = false,
  liveAngleTokens = false,
  valueContext,
}) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const propEntries = useMemo(
    () => withTrailingEmptyKey(value, canContainToken, expandable, liveAngleTokens),
    [value, canContainToken, expandable, liveAngleTokens],
  );
  const [draft, setDraft] = useState<KvEntry[] | null>(null);
  const entries = draft ?? propEntries;
  const duplicateIndexes = useMemo(() => findDuplicateKeyIndexes(entries), [entries]);
  const publishedRef = useRef<KvEntry[] | null>(null);

  useEffect(() => {
    if (!draft) {
      return;
    }
    if (draft.some(([k, v]) => k.trim() !== "" && isIncompleteJsonLiteral(v))) {
      return;
    }
    if (findDuplicateKeyIndexes(draft).size > 0) {
      return;
    }
    // Same keys and values came back. Drop the draft so the blank next-key
    // row from props is shown. The placeholder row is not part of the compare.
    if (kvEntriesContentEqual(draft, propEntries)) {
      publishedRef.current = null;
      setDraft(null);
      return;
    }
    const echo = publishedRef.current;
    if (echo && kvEntriesContentEqual(draft, echo)) {
      const shown = withTrailingEmptyRow(draft, expandable);
      if (!kvEntriesEqual(draft, shown)) {
        publishedRef.current = shown;
        setDraft(shown);
      }
      return;
    }
    publishedRef.current = null;
    setDraft(null);
  }, [propEntries, draft, expandable]);

  const publish = (next: KvEntry[]) => {
    const shown = withTrailingEmptyRow(next, expandable);
    publishedRef.current = shown;
    setDraft(shown);
    if (next.some(([k, v]) => k.trim() !== "" && isIncompleteJsonLiteral(v))) {
      return;
    }
    onChange(entriesToUniqueRecord(
      next,
      (display) => inputBoxToYamlValueWithTokens(display, canContainToken, liveAngleTokens),
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
    <div className="mmt-fill">
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
            .filter(([k], index) => !(deactivated && k === "" && index === entries.length - 1))
            .map(([k, v], index) => (
              <tr key={index}>
                <td>
                  <StableTextInput
                    value={k}
                    onChange={next => handleKeyChange(index, next)}
                    placeholder={keyPlaceholder}
                    disabled={disabled || keysDisabled}
                    className={duplicateIndexes.has(index) ? "is-invalid" : undefined}
                    title={duplicateIndexes.has(index) ? "Duplicate key" : undefined}
                    aria-invalid={duplicateIndexes.has(index)}
                    {...{ [KV_FIELD_ATTR]: kvFieldId(index, "key") }}
                  />
                </td>
                <td>
                  {k.trim() !== "" && (
                    <FieldWithRemove
                      value={String(v ?? "")}
                      onChange={newVal => handleValueChange(index, newVal)}
                      onRemovePressed={() => handleRemove(index)}
                      placeholder={valuePlaceholder}
                      disabled={disabled}
                      removable={deletable && !deactivated}
                      canContainToken={canContainToken}
                      valueContext={valueContext}
                      kvField={kvFieldId(index, "value")}
                      typeLabel={
                        !duplicateIndexes.has(index) && value?.[k] !== undefined
                          ? yamlValueTypeLabel(value?.[k])
                          : undefined
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

export default KVEditor;
