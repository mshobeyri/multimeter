import React, { useRef } from "react";
import FieldWithRemove from "./FieldWithRemove";
import FieldWithOptionsPicker from "./FieldWithOptionsPicker";
import SelectWithRemove from "./SelectWithRemove";
import { ParamConstraintOption } from "mmt-core/paramConstraints";
import { safeList } from "mmt-core/safer";
import { JSONRecord, JSONValue } from "mmt-core/CommonData";
import {
  yamlValueToInputBoxWithTokens,
  inputBoxToYamlValueWithTokens,
} from "./convertor";
import { yamlValueTypeLabel } from "mmt-core/yamlValueConvert";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";
import { handleKvEditorTab, kvFieldId } from "./kvFieldNav";

interface VEditorProps {
  label: string;
  value?: JSONRecord;
  onChange: (v: JSONRecord) => void;
  keyOptions: string | string[];         // List of allowed keys
  valueOptions?: string[];      // List of allowed values (optional)
  /** Per-input options from `<<i:name>> [a, b]` description annotations */
  inputConstraints?: Record<string, ParamConstraintOption[]>;
  disabled?: boolean;
  /** Non-editable but visually normal (unlike disabled). */
  readOnly?: boolean;
  deletable?: boolean;
  copyable?: boolean;
  /** Per-key match status vs selected example expected outputs (shown beside the field). */
  matchStatus?: ReadonlyMap<string, "match" | "mismatch">;
  /** Value fields: resolved/token dual-mode when a value contains tokens. */
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
}

const VEditor: React.FC<VEditorProps> = ({
  label,
  value,
  onChange,
  keyOptions,
  valueOptions,
  inputConstraints,
  disabled,
  readOnly = false,
  deletable = true,
  copyable = false,
  matchStatus,
  canContainToken = false,
  valueContext,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const keys = typeof keyOptions === "string" ? [keyOptions]: keyOptions;

  const handleValueChange = (keyIndex: number, newVal: string) => {
    const key = keys[keyIndex];
    if (!key) return;

    const updated: JSONRecord = { ...(value || {}) };

    if (newVal.trim() === "") {
      // Remove the key if value is empty
      delete updated[key];
    } else {
      updated[key] = inputBoxToYamlValueWithTokens(newVal, canContainToken);
    }
    onChange(updated);
  };

  const handlePickedValue = (keyIndex: number, newVal: JSONValue) => {
    const key = keys[keyIndex];
    if (!key) return;

    const updated: JSONRecord = { ...(value || {}) };
    updated[key] = newVal;
    onChange(updated);
  };

  const handleRemove = (keyIndex: number) => {
    const key = keys[keyIndex];
    if (!key) return;

    const updated: JSONRecord = { ...(value || {}) };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div
      className="mmt-fill"
      ref={rootRef}
      onKeyDown={e => {
        handleKvEditorTab(e, rootRef.current);
      }}
    >
      {label ? (
        <div className={disabled ? "label label-disabled is-gap" : "label is-gap"}>
          {label}
        </div>
      ) : null}
      <div>
        {safeList(keys).map((key, index) => {
          const currentValue = value?.[key];
          const displayValue = yamlValueToInputBoxWithTokens(
            currentValue,
            canContainToken,
          );
          const hasValue = currentValue !== undefined;
          const typeLabel = yamlValueTypeLabel(currentValue);
          const pickerOptions = inputConstraints?.[key];
          const fieldMatch = matchStatus?.get(key);
          const valueField = kvFieldId(index, "value");

          const fieldControl = valueOptions && valueOptions.length > 0 ? (
            <SelectWithRemove
              value={displayValue}
              onChange={newVal => handleValueChange(index, newVal)}
              onRemovePressed={() => handleRemove(index)}
              options={valueOptions}
              placeholder="Value"
              disabled={disabled || readOnly}
              removable={deletable && !readOnly}
              typeLabel={hasValue ? typeLabel : undefined}
              kvField={valueField}
            />
          ) : pickerOptions && pickerOptions.length > 0 ? (
            <FieldWithOptionsPicker
              value={displayValue}
              onChange={newVal => handleValueChange(index, newVal)}
              onPick={newVal => handlePickedValue(index, newVal)}
              onRemovePressed={() => handleRemove(index)}
              options={pickerOptions}
              placeholder="Value"
              disabled={disabled || readOnly}
              removable={deletable && hasValue && !readOnly}
              copyable={copyable}
              typeLabel={hasValue ? typeLabel : undefined}
              kvField={valueField}
            />
          ) : (
            <FieldWithRemove
              value={displayValue}
              onChange={newVal => handleValueChange(index, newVal)}
              onRemovePressed={() => handleRemove(index)}
              placeholder="Value"
              disabled={disabled}
              readOnly={readOnly}
              removable={deletable && hasValue && !readOnly}
              copyable={copyable}
              canContainToken={canContainToken && !readOnly}
              valueContext={valueContext}
              typeLabel={hasValue ? typeLabel : undefined}
              kvField={valueField}
            />
          );

          // Fixed-width slot before the value field (same size as expect rows).
          // Empty twin on the key row keeps header/value aligned with no jump.
          const showMatchGutter = matchStatus != null;

          return (
            <div
              key={key}
              className={`veditor-row${showMatchGutter ? " has-match-gutter" : ""}`}
            >
              <div className="veditor-key-row field-inline">
                {showMatchGutter ? (
                  <span className="apitest-result-slot no-shrink" aria-hidden />
                ) : null}
                <span className="veditor-key">{key}</span>
              </div>
              <div className="field-inline">
                {showMatchGutter ? (
                  <span
                    className={`apitest-result-slot no-shrink${
                      fieldMatch === "match" ? " is-pass" : ""
                    }${fieldMatch === "mismatch" ? " is-fail" : ""}`}
                    title={fieldMatch === "match"
                      ? "Matches example expect"
                      : fieldMatch === "mismatch"
                        ? "Does not match example expect"
                        : undefined}
                    aria-label={fieldMatch === "match"
                      ? "Matches example expect"
                      : fieldMatch === "mismatch"
                        ? "Does not match example expect"
                        : undefined}
                    aria-hidden={!fieldMatch}
                  >
                    {fieldMatch === "match"
                      ? <span className="codicon codicon-check" />
                      : null}
                    {fieldMatch === "mismatch"
                      ? <span className="codicon codicon-close" />
                      : null}
                  </span>
                ) : null}
                <div className="field-grow">
                  {fieldControl}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VEditor;