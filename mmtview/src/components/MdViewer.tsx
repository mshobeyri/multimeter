import React, { useMemo } from "react";
import { simpleMarkdownToHtml, parseParamDescriptions } from "mmt-core/docHtml";
import { JSONRecord } from "mmt-core/CommonData";

interface MdViewerProps {
  description: string;
  inputs?: JSONRecord;
  outputs?: Record<string, string>;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildParamTable(
  label: string,
  params: Record<string, any>,
  annotations: Record<string, string>
): string {
  const keys = Object.keys(params);
  if (!keys.length) { return ''; }
  const hasDesc = keys.some(k => annotations[k]);
  let html = `<div style="margin-top:8px"><span style="font-weight:600;font-size:12px">${label}</span>`;
  html += '<table><thead><tr><th>Name</th><th>Value</th>';
  if (hasDesc) { html += '<th>Description</th>'; }
  html += '</tr></thead><tbody>';
  for (const k of keys) {
    const val = params[k];
    const display = val === null || val === undefined ? '' : String(val);
    html += `<tr><td><code>${escapeHtml(k)}</code></td><td>${escapeHtml(display)}</td>`;
    if (hasDesc) {
      html += `<td>${escapeHtml(annotations[k] || '')}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

const MdViewer: React.FC<MdViewerProps> = ({ description, inputs, outputs }) => {
  const html = useMemo(() => {
    if (!description) { return ''; }
    const { cleaned, params } = parseParamDescriptions(description);
    let result = simpleMarkdownToHtml(cleaned, 'h4');
    if (inputs && Object.keys(inputs).length) {
      result += buildParamTable('Inputs', inputs, params.inputs);
    }
    if (outputs && Object.keys(outputs).length) {
      result += buildParamTable('Outputs', outputs, params.outputs);
    }
    return result;
  }, [description, inputs, outputs]);

  if (!html) { return null; }

  return (
    <div
      className="doc-preview"
      style={{
        padding: "8px 12px",
        fontSize: "12px",
        lineHeight: 1.6,
        color: "var(--vscode-editor-foreground, #ccc)",
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MdViewer;
