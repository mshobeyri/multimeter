import React from "react";
import { ResponseDisplayState } from "../api/responseBodyDisplay";
import BinaryImagePreview from "./BinaryImagePreview";
import BodyView from "./BodyView";
import HtmlPreview from "./HtmlPreview";

type ResponseBodyContentProps = {
  display: ResponseDisplayState;
  refreshKey: number;
  requestUrl?: string;
  onInspectPosition?: (info: { line: number; column: number; text: string }) => void;
};

const ResponseBodyContent: React.FC<ResponseBodyContentProps> = ({
  display,
  refreshKey,
  requestUrl,
  onInspectPosition,
}) => {
  if (display.effectiveView === "preview" && display.previewKind === "html") {
    return (
      <HtmlPreview
        html={display.previewHtml ?? ""}
        baseUrl={requestUrl}
      />
    );
  }
  if (display.effectiveView === "preview" &&
      display.previewKind === "image" &&
      display.previewImageUrl) {
    return <BinaryImagePreview dataUrl={display.previewImageUrl} />;
  }
  return (
    <BodyView
      value={display.displayText}
      format={display.resolvedType}
      mode="live"
      onInspectPosition={onInspectPosition}
      refreshKey={refreshKey}
    />
  );
};

export default ResponseBodyContent;
