import React, { useLayoutEffect, useRef, useState } from "react";
import parseYaml from "mmt-core/markupConvertor";
import { typeOptions } from "mmt-core/CommonData";
import MultimeterLogo from "./components/MultimeterLogo";
import {
  notypeHelpLinks,
  notypeSamples,
  notypeTypeColors,
  notypeTypeIcons,
  type NotypeSampleType,
} from "./notypeSamples";
import { maxItemsPerRow, packTypeRows } from "./notypeTypeRows";
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
    url: "https://github.com/mshobeyri/multimeter/issues/new?labels=enhancement&template=feature_request.yml",
    icon: "feedback" as const,
  },
] as const;

const NotypePanel: React.FC<NotypePanelProps> = ({ content, setContent }) => {
  const handleTypeChange = (type: string) => {
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
          <NotypeTypeIcons onSelect={handleTypeChange} />
        </div>

        <div className="notype-divider" aria-hidden>Or select sample from gallery</div>

        <div className="notype-gallery" role="list">
          {notypeSamples.map(sample => {
            const typeLabel = typeOptions.find(opt => opt.value === sample.type)?.label ?? sample.type;
            const help = notypeHelpLinks[sample.type];
            return (
              <div
                key={`${sample.type}-${sample.title}`}
                className="notype-sample-card"
                role="listitem"
              >
                <button
                  type="button"
                  className="notype-sample-main"
                  onClick={() => setContent(sample.content)}
                >
                  <span className="notype-sample-body">
                    <span className="notype-sample-head">
                      <span className="notype-sample-title">{sample.title}</span>
                      <span className="notype-sample-badge">{typeLabel}</span>
                    </span>
                    <span className="notype-sample-desc">{sample.description}</span>
                  </span>
                </button>
                <div className="notype-sample-help" aria-label={`${sample.title} links`}>
                  <button
                    type="button"
                    className="notype-sample-help-btn"
                    title="Open documentation"
                    aria-label={`Open ${typeLabel} documentation`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openExternalUrl(help.docsUrl);
                    }}
                  >
                    <span className="codicon codicon-question" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="notype-sample-help-btn"
                    title="Watch demo"
                    aria-label={`Watch ${typeLabel} demo`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openExternalUrl(help.demoUrl);
                    }}
                  >
                    <span className="codicon codicon-play" aria-hidden />
                  </button>
                </div>
              </div>
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

function NotypeTypeIcons({ onSelect }: { onSelect: (type: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [maxPerRow, setMaxPerRow] = useState(typeOptions.length);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      return;
    }

    const update = () => {
      const item = el.querySelector(".notype-type-icon-btn") as HTMLElement | null;
      const styles = getComputedStyle(el.querySelector(".notype-type-icons-row") || el);
      const gap = Number.parseFloat(styles.columnGap || styles.gap) || 12;
      const itemWidth = item?.offsetWidth || 72;
      setMaxPerRow(maxItemsPerRow(el.clientWidth, itemWidth, gap));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rows = packTypeRows(typeOptions, maxPerRow);

  return (
    <div
      ref={wrapRef}
      className="notype-type-icons"
      role="group"
      aria-label="Document types"
    >
      {rows.map((row) => (
        <div key={row.map((opt) => opt.value).join("-")} className="notype-type-icons-row">
          {row.map((opt) => {
            const type = opt.value as NotypeSampleType;
            const color = notypeTypeColors[type];
            const icon = notypeTypeIcons[type];
            return (
              <button
                key={opt.value}
                type="button"
                className="notype-type-icon-btn"
                title={opt.label}
                aria-label={opt.label}
                data-mmt-coach={opt.value === "api" ? "gallery" : undefined}
                style={{ "--notype-type-color": color } as React.CSSProperties}
                onClick={() => onSelect(opt.value)}
              >
                <span className="notype-type-icon-glyph" aria-hidden>
                  <span className={`codicon codicon-${icon}`} />
                </span>
                <span className="notype-type-icon-label">{opt.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default NotypePanel;
