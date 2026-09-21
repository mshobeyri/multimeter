import React, { useEffect, useState } from "react";
import { Format } from "mmt-core/CommonData";
import {
  BODY_FORMAT_TOP_LEVEL,
  DEFAULT_RAW_FORMAT,
  FormatChip,
  RawFormatSelect,
  isRawFormat,
  topLevelForFormat,
  type BodyFormatTopLevel,
} from "./BodyFormatControls";

type BodyFormatBarProps = {
  value: Format;
  onChange: (format: Format) => void;
};

const BodyFormatBar: React.FC<BodyFormatBarProps> = ({ value, onChange }) => {
  const rawSelected = isRawFormat(value);
  const [lastRawFormat, setLastRawFormat] = useState<Format>(
    rawSelected ? value : DEFAULT_RAW_FORMAT
  );

  useEffect(() => {
    if (rawSelected) {
      setLastRawFormat(value);
    }
  }, [rawSelected, value]);

  const selectTopLevel = (level: BodyFormatTopLevel) => {
    if (level === "raw") {
      onChange(rawSelected ? value : lastRawFormat);
      return;
    }
    onChange(level);
  };

  return (
    <div className="apitest-body-format-bar" role="tablist" aria-label="Body format">
      {BODY_FORMAT_TOP_LEVEL.map(level => (
        <FormatChip
          key={level}
          label={level}
          selected={topLevelForFormat(value) === level}
          title={level === "multipart" ? "multipart/form-data (Postman form-data)" : undefined}
          onClick={() => selectTopLevel(level)}
        />
      ))}
      {rawSelected ? (
        <RawFormatSelect
          value={value}
          onChange={format => {
            setLastRawFormat(format);
            onChange(format);
          }}
        />
      ) : null}
    </div>
  );
};

export default BodyFormatBar;
