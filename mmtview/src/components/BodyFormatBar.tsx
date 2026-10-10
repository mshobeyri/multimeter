import React from "react";
import { RequestFormat } from "mmt-core/CommonData";
import {
  BodyFormatSelect,
  REQUEST_BODY_FORMAT_MENU,
} from "./BodyFormatControls";

type BodyFormatBarProps = {
  value: RequestFormat;
  storageMode: "plain" | "encoded";
  encodeError?: boolean;
  onChange: (format: RequestFormat, storageMode?: "plain" | "encoded") => void;
};

const BodyFormatBar: React.FC<BodyFormatBarProps> = ({
  value,
  storageMode,
  encodeError = false,
  onChange,
}) => {
  const selectedEntryId = ["json", "xml", "xmle", "text", "html", "urlencoded"].includes(value)
    ? `${storageMode}-${value}`
    : undefined;
  const triggerSuffix = selectedEntryId && storageMode === "encoded" ? "-yml" : undefined;
  const triggerValue = value;
  const triggerTitle = encodeError
    ? "YAML encoding is unavailable; the body is currently stored as raw text."
    : selectedEntryId && storageMode === "encoded"
      ? `${value}-yml`
      : selectedEntryId
        ? value
        : value;

  return (
    <div className="apitest-body-format-bar" aria-label="Body format">
      <BodyFormatSelect
        value={value}
        menu={REQUEST_BODY_FORMAT_MENU}
        selectedEntryId={selectedEntryId}
        triggerValue={triggerValue}
        triggerSuffix={triggerSuffix}
        strikeTriggerSuffix={encodeError && Boolean(triggerSuffix)}
        triggerTitle={triggerTitle}
        onChange={(format, entry) => onChange(format, entry?.storageMode)}
        ariaLabel="Body format"
      />
    </div>
  );
};

export default BodyFormatBar;
