import React, { useMemo, useState } from 'react';
import {
  beautifyBody,
  canBeautifyBody,
  detectBodyFormat,
  highlightBodyHtml,
} from './bodyHighlight';

export type HighlightedBodyProps = {
  label?: string;
  body?: any;
  headers?: Record<string, any>;
  /** Max height of the pre block (px). Default 300. */
  maxHeight?: number;
};

function toBodyString(body: any): string {
  if (body === undefined || body === null) {
    return '';
  }
  if (typeof body === 'string') {
    return body.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

/**
 * Read-only body preview with type-based coloring, Format/Raw, copy, and border.
 * Used in test/suite/report step details (only mounts when details are expanded).
 */
const HighlightedBody: React.FC<HighlightedBodyProps> = ({
  label = 'Body',
  body,
  headers,
  maxHeight = 300,
}) => {
  const rawBody = useMemo(() => toBodyString(body), [body]);
  const canFormat = Boolean(rawBody) &&
    (canBeautifyBody(rawBody, headers) || typeof body !== 'string');
  // Auto-pretty when the panel opens; user can still switch to Raw.
  const [formatted, setFormatted] = useState(canFormat);
  const [copied, setCopied] = useState(false);

  if (!rawBody) {
    return null;
  }

  const displayBody = formatted ? beautifyBody(rawBody, headers) : rawBody;
  const format = detectBodyFormat(displayBody, headers);
  const html = highlightBodyHtml(displayBody, headers);

  const copy = () => {
    navigator.clipboard.writeText(displayBody).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  };

  return (
    <div className="highlighted-body" style={{ marginTop: 6 }}>
      <div className="highlighted-body-header">
        <span className="highlighted-body-label">{label}</span>
        <span className="highlighted-body-format" title="Detected body type">{format}</span>
        <div className="highlighted-body-actions">
          {canFormat && (
            <button
              type="button"
              className="highlighted-body-btn"
              onClick={() => setFormatted((f) => !f)}
              title={formatted ? 'Show raw' : 'Format body'}
            >
              {formatted ? 'Raw' : 'Format'}
            </button>
          )}
          <button
            type="button"
            className="highlighted-body-btn highlighted-body-btn-icon"
            onClick={copy}
            title={copied ? 'Copied' : 'Copy body'}
          >
            <span className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`} />
          </button>
        </div>
      </div>
      <pre
        className={`highlighted-body-pre bh-${format}`}
        style={{ maxHeight }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

export default HighlightedBody;
