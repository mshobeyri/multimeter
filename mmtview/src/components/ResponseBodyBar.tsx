import React, { useLayoutEffect, useRef, useState } from "react";
import { ResponseFormat } from "mmt-core/CommonData";
import type { ResponseViewMode } from "../api/responseBodyDisplay";
import {
  BodyFormatSelect,
  FormatChip,
  RESPONSE_BODY_FORMAT_MENU,
} from "./BodyFormatControls";
import { BodyViewValidationIndicator } from "./BodyViewToolbarControls";
import type { BodyViewToolbarState } from "./BodyView";
import { shouldUseCompactResponseControls } from "./responseBodyBarLayout";

type ResponseBodyBarProps = {
  type: ResponseFormat;
  view: ResponseViewMode;
  prettyAvailable: boolean;
  previewAvailable: boolean;
  bodyToolbar: BodyViewToolbarState | null;
  onTypeChange: (type: ResponseFormat) => void;
  onViewChange: (view: ResponseViewMode) => void;
};

const ResponseBodyBar: React.FC<ResponseBodyBarProps> = ({
  type,
  view,
  prettyAvailable,
  previewAvailable,
  bodyToolbar,
  onTypeChange,
  onViewChange,
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const viewOptions: ResponseViewMode[] = [
    ...(prettyAvailable || view === "pretty" ? ["pretty" as const] : []),
    "raw",
    ...(previewAvailable || view === "preview" ? ["preview" as const] : []),
  ];
  useLayoutEffect(() => {
    const element = toolbarRef.current;
    const row = element?.closest(".apitest-response-tabs-row");
    const meta = row?.querySelector(".apitest-response-meta");
    if (!row || !meta) {
      return;
    }
    const updateLayout = () => {
      setCompact(shouldUseCompactResponseControls(
        row.getBoundingClientRect().width,
        meta.getBoundingClientRect().width,
      ));
    };
    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(row);
    observer.observe(meta);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`apitest-body-toolbar${compact ? " is-compact" : ""}`}
      aria-label="Response body controls"
      ref={toolbarRef}
    >
      <div className="apitest-body-toolbar-main">
        <BodyViewValidationIndicator toolbar={bodyToolbar} />
        <BodyFormatSelect
          value={type}
          menu={RESPONSE_BODY_FORMAT_MENU}
          onChange={onTypeChange}
          ariaLabel="Response body format"
        />
        {compact ? (
          <BodyFormatSelect
            value={view}
            options={viewOptions}
            onChange={onViewChange}
            ariaLabel="Response body display"
          />
        ) : (
          <div className="apitest-body-format-bar-group" role="radiogroup" aria-label="Response body display">
            {viewOptions.map(option => (
              <FormatChip
                key={option}
                label={option}
                selected={view === option}
                onClick={() => onViewChange(option)}
              />
            ))}
          </div>
        )}
        {bodyToolbar?.canBeautify ? (
          <div className="bodyview-header-actions">
            <button
              type="button"
              className="button-icon no-shrink section-edit-toggle"
              title="Beautify"
              aria-label="Beautify body"
              onMouseDown={event => event.preventDefault()}
              onClick={bodyToolbar.beautify}
            >
              <span className="codicon codicon-wand" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ResponseBodyBar;
