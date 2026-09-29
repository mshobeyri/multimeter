import React from "react";
import FieldWithRemove from "./FieldWithRemove";
import FieldWithOptionsPicker from "./FieldWithOptionsPicker";
import SelectWithRemove from "./SelectWithRemove";
import { ParamConstraintOption } from "mmt-core/paramConstraints";
import { safeList } from "mmt-core/safer";
import { JSONRecord, JSONValue } from "mmt-core/CommonData";
import { valueToString, stringToValue, peerFieldToValue } from "./convertor";
import { isOmitSentinel } from "mmt-core/omitKeyword";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";
import { peerStringToDisplay } from "mmt-core/apiBodyEdit";

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
  const keys = typeof keyOptions === "string" ? [keyOptions]: keyOptions;

  const handleValueChange = (keyIndex: number, newVal: string) => {
    const key = keys[keyIndex];
    if (!key) return;

    const updated: JSONRecord = { ...(value || {}) };

    if (newVal.trim() === "") {
      // Remove the key if value is empty
      delete updated[key];
    } else if (canContainToken) {
      updated[key] = peerFieldToValue(newVal);
    } else {
      // Convert string input to match original type
      updated[key] = stringToValue(newVal);
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
    <div className="mmt-fill">
      <div className={disabled ? "label label-disabled is-gap" : "label is-gap"}>
        {label}
      </div>
      <div>
        {safeList(keys).map((key, index) => {
          const currentValue = value?.[key];
          const displayValue = typeof currentValue === "string" && canContainToken
            ? peerStringToDisplay(currentValue)
            : valueToString(currentValue);
          const hasValue = currentValue !== undefined;
          const typeLabel = currentValue === null
            ? "null"
            : isOmitSentinel(currentValue)
              ? "omit"
              : Array.isArray(currentValue)
                ? "array"
                : typeof currentValue;
          const pickerOptions = inputConstraints?.[key];
          const fieldMatch = matchStatus?.get(key);

          const fieldControl = valueOptions && valueOptions.length > 0 ? (
            <SelectWithRemove
              value={displayValue}
              onChange={newVal => handleValueChange(index, newVal)}
              onRemovePressed={() => handleRemove(index)}
              options={valueOptions}
              placeholder="Value"
              disabled={disabled || readOnly}
              removable={deletable && !readOnly}
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
            />
          );

          // Reserve a fixed result gutter whenever matchStatus is provided so
          // pass/fail icons don't shift header + value when they appear.
          const showMatchGutter = matchStatus != null;

          return (
            <div
              key={key}
              className={`veditor-row${showMatchGutter ? " has-match-gutter" : ""}`}
            >
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
              <div className="veditor-main">
                <div className="veditor-key-row">
                  <span className="veditor-key">{key}</span>
                  {hasValue && (
                    <span className="veditor-type">
                      ({typeLabel})
                    </span>
                  )}
                </div>
                <div className="field-inline">
                  <div className="field-grow">
                    {fieldControl}
                  </div>
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