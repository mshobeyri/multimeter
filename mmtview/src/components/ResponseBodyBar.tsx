import React, { useEffect, useState } from "react";
import { ResponseFormat } from "mmt-core/CommonData";
import { ResponseViewMode } from "../api/responseBodyDisplay";
import {
  DEFAULT_RAW_FORMAT,
  FormatChip,
  RawFormatSelect,
  type RawBodyFormat,
  RESPONSE_BODY_FORMAT_TOP_LEVEL,
  isRawFormat,
  topLevelForFormat,
  type BodyFormatTopLevel,
} from "./BodyFormatControls";

type ResponseBodyBarProps = {
  type: ResponseFormat;
  view: ResponseViewMode;
  previewAvailable: boolean;
  onTypeChange: (type: ResponseFormat) => void;
  onViewChange: (view: ResponseViewMode) => void;
};

const ResponseBodyBar: React.FC<ResponseBodyBarProps> = ({
  type,
  view,
  previewAvailable,
  onTypeChange,
  onViewChange,
}) => {
  const rawSelected = type !== "auto" && isRawFormat(type);
  const [lastRawFormat, setLastRawFormat] = useState<RawBodyFormat>(() => {
    if (type !== "auto" && isRawFormat(type)) {
      return type;
    }
    return DEFAULT_RAW_FORMAT;
  });

  useEffect(() => {
    if (type !== "auto" && isRawFormat(type)) {
      setLastRawFormat(type);
    }
  }, [type]);

  const selectTopLevel = (level: Exclude<BodyFormatTopLevel, "none">) => {
    if (level === "raw") {
      if (rawSelected) {
        onTypeChange(type);
      } else {
        onTypeChange(lastRawFormat);
      }
      return;
    }
    onTypeChange(level);
  };

  return (
    <div className="apitest-body-format-bar" role="tablist" aria-label="Response body view">
      <div className="apitest-body-format-bar-group">
        <FormatChip
          label="auto"
          selected={type === "auto"}
          onClick={() => onTypeChange("auto")}
        />
        {RESPONSE_BODY_FORMAT_TOP_LEVEL.map(level => (
          <FormatChip
            key={level}
            label={level}
            selected={type !== "auto" && topLevelForFormat(type) === level}
            title={level === "multipart" ? "multipart/form-data (Postman form-data)" : undefined}
            onClick={() => selectTopLevel(level)}
          />
        ))}
        {rawSelected ? (
          <RawFormatSelect
            value={type}
            onChange={format => {
              setLastRawFormat(format);
              onTypeChange(format);
            }}
          />
        ) : null}
      </div>
      <span className="apitest-body-format-divider" aria-hidden />
      <div className="apitest-body-format-bar-group">
        <FormatChip
          label="pretty"
          selected={view === "pretty"}
          onClick={() => onViewChange("pretty")}
        />
        <FormatChip
          label="raw"
          selected={view === "raw"}
          onClick={() => onViewChange("raw")}
        />
        {previewAvailable ? (
          <FormatChip
            label="preview"
            selected={view === "preview"}
            onClick={() => onViewChange("preview")}
          />
        ) : null}
      </div>
    </div>
  );
};

export default ResponseBodyBar;
