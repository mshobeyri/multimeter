import React, { useMemo, useCallback, useState, useEffect } from "react";
import { simpleMarkdownToHtml, parseParamDescriptions, parseRefDescription, extractMarkdownSection, resolveRefPath } from "mmt-core/docHtml";
import { JSONRecord } from "mmt-core/CommonData";
import { readFile, openRelativeFile } from "../vsAPI";

interface MdViewerProps {
  description: string;
  inputs?: JSONRecord;
  outputs?: Record<string, string>;
  /** Source file path of the API (used to resolve relative ref paths). */
  basePath?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildParamTable(
  params: Record<string, any>,
  annotations: Record<string, string>
): string {
  const keys = Object.keys(params);
  if (!keys.length) { return ''; }
  const hasDesc = keys.some(k => annotations[k]);
  let html = '<table><thead><tr><th>Name</th><th>Value</th>';
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
  html += '</tbody></table>';
  return html;
}

interface DescriptionParts {
  descHtml: string;
  inputsHtml: string;
  outputsHtml: string;
}

function renderDescriptionParts(desc: string, inputs?: JSONRecord, outputs?: Record<string, string>): DescriptionParts {
  if (!desc) { return { descHtml: '', inputsHtml: '', outputsHtml: '' }; }
  const { cleaned, params } = parseParamDescriptions(desc);
  const descHtml = simpleMarkdownToHtml(cleaned, 'h4');
  const inputsHtml = (inputs && Object.keys(inputs).length) ? buildParamTable(inputs, params.inputs) : '';
  const outputsHtml = (outputs && Object.keys(outputs).length) ? buildParamTable(outputs, params.outputs) : '';
  return { descHtml, inputsHtml, outputsHtml };
}

const MdViewer: React.FC<MdViewerProps> = ({ description, inputs, outputs, basePath }) => {
  const ref = useMemo(() => parseRefDescription(description), [description]);
  const resolvedRefHref = useMemo(() => {
    if (!ref) { return ''; }
    const resolvedPath = resolveRefPath(ref.path, basePath);
    return `${resolvedPath}#${ref.fragment}`;
  }, [ref, basePath]);
  const [resolvedDesc, setResolvedDesc] = useState<string | null>(null);

  useEffect(() => {
    if (!ref) {
      setResolvedDesc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resolvedPath = resolveRefPath(ref.path, basePath);
        const content = await readFile(resolvedPath, { silent: true });
        const section = extractMarkdownSection(content, ref.fragment);
        if (!cancelled) { setResolvedDesc(section || description); }
      } catch {
        if (!cancelled) { setResolvedDesc(description); }
      }
    })();
    return () => { cancelled = true; };
  }, [ref, description, basePath]);

  const { descHtml, inputsHtml, outputsHtml } = useMemo(() => {
    const desc = ref ? (resolvedDesc ?? '') : description;
    return renderDescriptionParts(desc, inputs, outputs);
  }, [ref, resolvedDesc, description, inputs, outputs]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' && target.classList.contains('desc-ref')) {
      e.preventDefault();
      const href = target.getAttribute('href');
      if (href) {
        const filePath = href.replace(/#.*$/, '');
        const hashIdx = href.indexOf('#');
        const fragment = hashIdx >= 0 ? href.slice(hashIdx + 1) : undefined;
        openRelativeFile(filePath, fragment);
      }
    }
  }, []);

  if (!descHtml && !inputsHtml && !outputsHtml) { return null; }

  const refLabel = ref ? description.trim() : '';
  return (
    <div
      className="doc-preview"
      onClick={handleClick}
    >
      {descHtml && (
        <>
          <div className="label is-flush">Description</div>
          {ref && (
            <div className="doc-preview-ref">
              <a
                className="desc-ref"
                href={resolvedRefHref}
                title={refLabel}
              >
                {refLabel}
              </a>
            </div>
          )}
          <div className="doc-preview-body" dangerouslySetInnerHTML={{ __html: descHtml }} />
        </>
      )}
      {inputsHtml && (
        <>
          <div className="label is-follow">Inputs</div>
          <div className="doc-preview-body" dangerouslySetInnerHTML={{ __html: inputsHtml }} />
        </>
      )}
      {outputsHtml && (
        <>
          <div className="label is-follow">Outputs</div>
          <div className="doc-preview-body" dangerouslySetInnerHTML={{ __html: outputsHtml }} />
        </>
      )}
    </div>
  );
};

export default MdViewer;
