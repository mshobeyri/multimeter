import React, { useMemo, useState } from "react";
import parseYaml from "mmt-core/markupConvertor";
import { typeOptions } from "mmt-core/CommonData";
import MultimeterLogo from "./components/MultimeterLogo";
import { notypeSamples } from "./notypeSamples";
import { openExternalUrl } from "./vsAPI";

interface NotypePanelProps {
  content: string;
  setContent: (c: string) => void;
}

const NOTYPE_CTAS = [
  {
    label: "Star the repo",
    url: "https://github.com/mshobeyri/multimeter",
    icon: "github" as const,
  },
  {
    label: "Star the extension",
    url: "https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter&ssr=false#review-details",
    icon: "vscode" as const,
  },
  {
    label: "Add your feedback",
    url: "https://github.com/mshobeyri/multimeter/issues/new?labels=enhancement&template=feature-request.md",
    icon: "feedback" as const,
  },
] as const;

const NotypePanel: React.FC<NotypePanelProps> = ({ content, setContent }) => {
  const [selectedType, setSelectedType] = useState("");

  const visibleSamples = useMemo(
    () => (selectedType
      ? notypeSamples.filter(sample => sample.type === selectedType)
      : notypeSamples),
    [selectedType]
  );

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    if (!type) {
      return;
    }
    let parsed: any = {};
    try {
      parsed = parseYaml(content) || {};
    } catch { }
    parsed.type = type;
    const yamlStr =
      `type: ${type}\n` +
      Object.entries(parsed)
        .filter(([k]) => k !== "type")
        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join("\n");
    setContent(yamlStr);
  };

  return (
    <div className="panel">
      <div className="panel-box notype-panel-box">
        <div className="notype-hero">
          <div className="notype-logo-wrap" aria-hidden>
            <MultimeterLogo size={52} className="notype-logo" />
          </div>
          <h1 className="notype-brand-name">Multimeter</h1>
          <p className="notype-tagline">Get started with your first .mmt file</p>
        </div>

        <div className="notype-type-section">
          <p className="notype-intro">
            Choose a document type for a blank template, or pick a sample below to load starter content into the editor.
          </p>

          <div className="panel-form">
            <div className="panel-form-row">
              <label className="notype-field-label" htmlFor="notype-type-select">Select document type</label>
              <select
                id="notype-type-select"
                className="notype-type-select"
                value={selectedType}
                onChange={e => handleTypeChange(e.target.value)}
              >
                <option value="">Choose a type…</option>
                {typeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="notype-divider" aria-hidden>or select sample from gallery</div>

        <div className="notype-gallery" role="list">
          {visibleSamples.map(sample => {
            const typeLabel = typeOptions.find(opt => opt.value === sample.type)?.label ?? sample.type;
            return (
              <button
                key={`${sample.type}-${sample.title}`}
                type="button"
                className="notype-sample-card"
                role="listitem"
                onClick={() => setContent(sample.content)}
              >
                <span className="notype-sample-icon" aria-hidden>
                  <span className={`codicon codicon-${sample.codicon}`} />
                </span>
                <span className="notype-sample-body">
                  <span className="notype-sample-head">
                    <span className="notype-sample-title">{sample.title}</span>
                    <span className="notype-sample-badge">{typeLabel}</span>
                  </span>
                  <span className="notype-sample-desc">{sample.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="notype-cta">
          <p className="notype-cta-copy">
            Help Multimeter grow — explore demos, star the repo, or tell us what you need.
          </p>
          <div className="notype-cta-actions" role="group" aria-label="Community links">
            {NOTYPE_CTAS.map(cta => (
              <button
                key={cta.url}
                type="button"
                className="notype-cta-button"
                onClick={() => openExternalUrl(cta.url)}
              >
                <span className="notype-cta-icon" aria-hidden>
                  {cta.icon === "github" && <span className="codicon codicon-github" />}
                  {cta.icon === "vscode" && <span className="codicon codicon-vscode" />}
                  {cta.icon === "feedback" && <span className="codicon codicon-comment-discussion" />}
                </span>
                <span className="notype-cta-button-label">{cta.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotypePanel;
