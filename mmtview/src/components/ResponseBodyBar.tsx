import React from "react";
import { ResponseFormat } from "mmt-core/CommonData";
import { ResponseViewMode } from "../api/responseBodyDisplay";
import {
  BodyFormatSelect,
  FormatChip,
  RESPONSE_BODY_FORMAT_MENU,
} from "./BodyFormatControls";

type ResponseBodyBarProps = {
  type: ResponseFormat;
  view: ResponseViewMode;
  prettyAvailable: boolean;
  previewAvailable: boolean;
  onTypeChange: (type: ResponseFormat) => void;
  onViewChange: (view: ResponseViewMode) => void;
};

const ResponseBodyBar: React.FC<ResponseBodyBarProps> = ({
  type,
  view,
  prettyAvailable,
  previewAvailable,
  onTypeChange,
  onViewChange,
}) => {
  return (
    <div className="apitest-body-toolbar" role="tablist" aria-label="Response body view">
      <div className="apitest-body-toolbar-main">
        <BodyFormatSelect
          value={type}
          menu={RESPONSE_BODY_FORMAT_MENU}
          onChange={onTypeChange}
          ariaLabel="Response body format"
        />
        <span className="apitest-body-format-divider" aria-hidden />
        <div className="apitest-body-format-bar-group">
          {prettyAvailable ? (
            <FormatChip
              label="pretty"
              selected={view === "pretty"}
              onClick={() => onViewChange("pretty")}
            />
          ) : null}
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
    </div>
  );
};

export default ResponseBodyBar;
