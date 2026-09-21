import React, { useMemo } from "react";
import { htmlWithBaseHref, resolveHtmlPreviewBase } from "../api/htmlPreview";

type HtmlPreviewProps = {
  html: string;
  baseUrl?: string;
};

const HtmlPreview: React.FC<HtmlPreviewProps> = ({ html, baseUrl }) => {
  const srcDoc = useMemo(() => {
    return htmlWithBaseHref(html, resolveHtmlPreviewBase(baseUrl));
  }, [html, baseUrl]);

  return (
    <div className="apitest-html-preview">
      <iframe
        className="apitest-html-preview-frame"
        sandbox="allow-scripts allow-forms"
        srcDoc={srcDoc}
        title="HTML preview"
      />
    </div>
  );
};

export default HtmlPreview;
